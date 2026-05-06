#!/usr/bin/env node
import { Command, Option } from '@commander-js/extra-typings';
import { executeBatch } from './aiva-api.js';
import type { RunTestBatchResponse } from './aiva-api.js';
import { validateAivaKey, parseLabels, isInRange, waitForBatchCompleted, validateResultPath } from './helpers.js';
import type { AIVAOptions, AIVAReport } from './helpers.js';
import { writeFile } from 'node:fs/promises';
import yoctoSpinner from 'yocto-spinner';
import path from 'node:path';
import { MIN_POLL_SECONDS, MAX_POLL_SECONDS } from './constants.js';

const program = new Command();
program
    .name('runner')
    .version('0.0.1')
    .description('Runner for AIVA tests.')
    .requiredOption('-k, --api-key <key>', 'AIVA API Key', validateAivaKey, '')
    .requiredOption(
        '-l, --labels <labels>',
        'Semicolon-separated labels that select which tests run (e.g. smoke;regression). At least one non-empty label is required after splitting.',
        parseLabels,
    )
    .option('-n, --max-number-of-agents <number>', 'Optional, Maximum number of agents the batch may use.', '1')
    .option('-b, --batch-name <name>', 'Optional, custom batch name.', '')
    .option('--global-variables-overrides <JSON>', 'Optional, JSON object applied to all tests in the batch {"username": "testuser"}', '{}')
    .option(
        '--variables-overrides-per-test <JSON>',
        'Optional, JSON object mapping test IDs to variable overrides. {"123e4567-e89b-12d3-a456-426614174000": { "user": "otheruser", "label": "success" }}',
        '{}',
    )
    .option('-g, --gateway-name <gateway-name>', 'Optional, Gateway name used by aiva-node during the test.')
    .option('-p, --poll-period <seconds>', 'Optional, Seconds to wait between status polls. Must be between 5 and 60.', '10')
    .option('-u --aiva-url <URL>', 'Optional, Batch API URL: POST to start the batch, GET {url}/{batchId} for status polling.', 'https://api.aiva.works/')
    .addOption(new Option('-F, --result-format <format>', 'Optional, format of the batch status result.').choices(['ctrf', 'junit']))
    .option(
        '-f --result-path <filepath>',
        'Optional, Path where the final CTRF or JUnit is written and uploaded as the batch-status artifact.',
        './batch-results.json',
    )
    .option('-v, --verbose', 'Optional, display verbose (debug) output')
    .action(async (options) => {
        const aivaOptions: AIVAOptions = {
            apiKey: options.apiKey,
            aivaUrl: options.aivaUrl,
            pollPeriod: parseInt(options.pollPeriod),
            format: options.resultFormat,
            verbose: options.verbose,
            logger: {
                logDebug: (message: string): void => console.debug(message),
                logInfo: (message: string): void => console.info(message),
            },
        };

        if (!isInRange(parseInt(options.pollPeriod, 10), MIN_POLL_SECONDS, MAX_POLL_SECONDS)) {
            program.error(`Poll period is invalid. Value must be between ${MIN_POLL_SECONDS} and ${MAX_POLL_SECONDS}.`, { exitCode: 2 });
        }

        try {
            await validateResultPath(options.resultPath);
        } catch (e) {
            program.error(e instanceof Error ? e.message : String(e), { exitCode: 2 });
        }
        const batchInfo: RunTestBatchResponse = await executeBatch(
            options.aivaUrl,
            options.apiKey,
            options.labels,
            options.maxNumberOfAgents,
            options.batchName,
            JSON.parse(options.globalVariablesOverrides),
            JSON.parse(options.variablesOverridesPerTest),
            options.gatewayName,
        );
        const spinner = yoctoSpinner({ text: 'Waiting for batch results...' });

        spinner.start();
        const report: AIVAReport = await waitForBatchCompleted(batchInfo.testBatchId, aivaOptions);
        spinner.stop();

        await writeFile(path.resolve(options.resultPath), report.reportContent, 'utf-8');

        if (!report.success) {
            program.error('Batch failed due to failed tests.', { exitCode: 1 });
        }
    });

program.parseAsync();
