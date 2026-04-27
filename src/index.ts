#!/usr/bin/env node
import { Command, Option } from '@commander-js/extra-typings';
import {executeBatch, getBatchStatus, getBatchStatusRaw} from './aiva-api.ts';
import type { RunTestBatchResponse } from './aiva-api.ts';
import { validateAivaKey, parseLabels, isValueInRange, sleep, isBatchFailed, isTestBatchRunning, logBatchResults, validateBatchProgress} from "./helpers.ts";

"./helpers.ts";
import { writeFile } from 'node:fs/promises';
import yoctoSpinner from 'yocto-spinner';
import type { CTRFReport } from 'ctrf';
import path from 'node:path';
import { MIN_POLL_SECONDS, MAX_POLL_SECONDS } from "./constants.ts";

const program = new Command();
program
    .version('0.0.1')
    .description('Runner for AIVA tests.')
    .requiredOption('-k, --api-key <key>', 'AIVA API Key', validateAivaKey, "")
    .requiredOption('-l, --labels <labels>', 'Semicolon separated list of test labels. Eg. "release;nightly"', parseLabels)
    .option('-n, --max-number-of-agents <number>', 'Optional, How many agents to use to run the test batch.', '1')
    .option('-b, --batch-name <name>', 'Optional, name of the batch.', '')
    .option('--global-variables-overrides <JSON>', 'Optional, Variable override for whole batch. {"username": "testuser"}', "{}")
    .option('--variables-overrides-per-test <JSON>', 'Optional, override variables in one test only. {"123e4567-e89b-12d3-a456-426614174000": { "user": "otheruser", "label": "success" }}', "{}")
    .option('-g, --gateway-name <gateway-name>', 'Optional, name of the gateway to use in the test batch.')
    .option('-p, --poll-period <seconds>', 'Optional, period between status checks of test batch. Range 5 s - 60 s.', '10')
    .option('-u --aiva-url <URL>', 'Optional, URL of AIVA instance.', 'https://api.aiva.works/')
    .addOption(new Option('-F, --result-format <format>', 'Optional, format of the batch status result.').choices(['ctrf', 'junit']))
    .option('-f --result-path <filepath>', 'Optional, where to save file with batch results.', './batch-results.json')
    .option('-t --test-progress-timeout <seconds>', 'Optional, timeout that cancels test run if no test finished in time', '600')
    .option('-v, --verbose', 'Optional, display verbose (debug) output')
    .action(async (options) => {
        if (!isValueInRange(parseInt(options.pollPeriod), MIN_POLL_SECONDS, MAX_POLL_SECONDS)) {
            program.error(`Poll period is invalid. Value must be between ${MIN_POLL_SECONDS} and ${MAX_POLL_SECONDS}.`, {exitCode: 2});
        }
        const batchInfo: RunTestBatchResponse = await executeBatch(
            options.aivaUrl + '/v1/batches',
            options.apiKey,
            options.labels,
            options.maxNumberOfAgents,
            options.batchName,
            JSON.parse(options.globalVariablesOverrides),
            JSON.parse(options.variablesOverridesPerTest),
            options.gatewayName,
        );
        const spinner = yoctoSpinner({ text: 'Waiting for batch results...' });

        let lastChangeOfPendingTests: Date | null = new Date();
        let previousNumberOfPendingTests: number = Number.MAX_SAFE_INTEGER;

        spinner.start();
        let batchStatus: CTRFReport = await getBatchStatus(options.aivaUrl, options.apiKey, batchInfo.testBatchId);
        while (isTestBatchRunning(batchStatus)) {
            await sleep(parseInt(options.pollPeriod));
            batchStatus = await getBatchStatus(options.aivaUrl, options.apiKey, batchInfo.testBatchId);
            if (options.verbose) console.debug(JSON.stringify(batchStatus, null, 4));
            try {
                lastChangeOfPendingTests = validateBatchProgress(previousNumberOfPendingTests, lastChangeOfPendingTests, parseInt(options.testProgressTimeout), batchStatus);
            } catch (error) {
                error instanceof Error ? program.error(JSON.stringify(error.message, null, 4), {exitCode: 3}) :
                program.error(JSON.stringify(error), {exitCode: 3});
            }
        }
        spinner.stop();

        logBatchResults(batchStatus);
        if (isBatchFailed(batchStatus)) {
            program.error('AIVA test batch has failed tests or tests that failed to start.', {exitCode: 1});
        }
        await writeFile(path.resolve(options.resultPath), JSON.stringify(batchStatus), 'utf-8');
        
        if (options.resultFormat != "ctrf" || options.resultFormat != undefined) {
            const xmlBatchStatus: string = await getBatchStatusRaw(options.aivaUrl, options.apiKey, batchInfo.testBatchId, options.resultFormat);
            await writeFile(path.resolve(options.resultPath), xmlBatchStatus, 'utf-8');
        }
    });

program.parseAsync();
