import { Command } from 'commander';
import { executeBatch, getBatchStatus } from './aiva-api.ts';
import { writeFile } from 'node:fs/promises';
import yoctoSpinner from 'yocto-spinner';
import type { CTRFReport, Summary, Test } from 'ctrf';

/** @param {string} labelsInput */
function parseLabels(labelsInput: string) {
    const labels: string[] = labelsInput
        .split(';')
        .map((s: string): string => s.trim())
        .filter((label: string) => label.length > 0);

    if (labels.length === 0) {
        throw new Error('labels must contain at least one label after splitting by semicolon(e.g. "nightly")');
    }
    return labels;
}

/**
 * @param {number} s - Seconds to wait for
 */
function sleep(s: number) {
    return new Promise((resolve) => setTimeout(resolve, s * 1000));
}

/**
 * @param batchStatusResponse
 * @returns {Boolean} True if there are no more pending tests
 */
function isTestBatchRunning(batchStatusResponse: CTRFReport): boolean {
    const pending: number = batchStatusResponse?.results?.summary?.pending ?? 0;
    return pending > 0;
}

function isBatchProgressing(
    previousNumberOfPendingTests: number,
    changeTimeOfPendingTests: Date | null,
    batchProgessTimeout: number,
    batchStatusResponse: CTRFReport,
): Date | null {
    const currentTime = new Date();
    if (changeTimeOfPendingTests == null) {
        changeTimeOfPendingTests = new Date();
    }
    if (batchStatusResponse?.results?.summary?.pending < previousNumberOfPendingTests) {
        return new Date();
        // "+" before Date due to https://github.com/Microsoft/TypeScript/issues/5710
    } else if (+currentTime - +changeTimeOfPendingTests > batchProgessTimeout * 1000) {
        program.error('Timeout waiting for pending tests.');
        return null;
    } else {
        return null;
    }
}

function isValueInRange(value: number, minValue: number, maxValue: number): boolean {
    return value >= minValue && value <= maxValue;
}

/**
 * @param startEpochMs - Unix epoch milliseconds (e.g. Date.getTime())
 * @param endEpochMs - Unix epoch milliseconds
 * @returns Duration as "Xh YYm ZZs" with minutes and seconds zero-padded to 2 digits
 */
function formatEpochDurationMs(startEpochMs: number, endEpochMs: number | null): string {
    if (endEpochMs == null) {
        return 'n/a';
    }
    const totalSec = Math.floor(Math.abs(endEpochMs - startEpochMs) / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

function log_batch_results(batchResults: CTRFReport): void {
    const summary: Summary = batchResults.results.summary;
    const startMs: number | undefined = summary.start;
    const stopMs: number | undefined = summary.stop;
    const duration: string = startMs !== undefined && stopMs !== undefined ? formatEpochDurationMs(startMs, stopMs) : 'n/a';
    const logLine = `Total: ${summary.tests}, Passed: ${summary.passed}, Failed: ${summary.failed}, Skipped: ${summary.skipped}, Duration: ${duration}`;
    console.log(logLine);
}

function isBatchFailed(batchStatus: CTRFReport): boolean {
    if (batchStatus?.results?.summary?.failed > 0) {
        return true;
    }
    const tests: Test[] = batchStatus.results.tests;
    for (const test of tests) {
        if (test.rawStatus === 'FailedToStart') {
            return true;
        }
    }
    return false;
}
const program = new Command();
program
    .version('0.0.1')
    .description('My Node CLI')
    .option('-k, --api-key <key>', 'You AIVA API Key')
    .option('-l, --labels <labels>', 'Semicolon separated list of test labels. Eg. "release;nightly"')
    .option('-n, --max-number-of-agents <number>', 'Optional, How many agents to use to run the test batch.', '1')
    .option('-b, --batch-name <name>', 'Optional, name of the batch.', '')
    .option('--global-variables-overrides <JSON>', 'Optional, Variable override for whole batch. {"username": "testuser"}')
    .option('--variables-overrides-per-test <JSON>', 'Optional, override variables in one test only.')
    .option('-g, --gateway-name <gateway-name>', 'Optional, name of the gateway to use in the test batch.')
    .option('-p, --poll-period <seconds>', 'Optional, period between status checks of test batch. Range 5 - 60.', '10')
    .option('-u --aiva-url <URL>', 'Optional, URL of AIVA instance.', 'https://api.aiva.works/v1/batches')
    .option('-F, --result-format <format>', 'Optional, format of the batch status result.', 'ctrf')
    .option('-f --result-path <filepath>', 'Optional, where to save file with batch results.', './batch-results.json')
    .option('-t --test-progress-timeout <seconds>', 'Optional, timeout that cancels test run if no test finished in time', '600')
    .option('-v, --verbose', 'Optional, display verbose (debug) output')
    .action(async (options) => {
        if (!isValueInRange(options.pollPeriod, 5, 60)) {
            program.error('Poll period is invalid.');
        }
        const parsedLabels: string[] = parseLabels(options.labels);
        const batchId = await executeBatch(
            options.aivaUrl,
            options.apiKey,
            parsedLabels,
            options.maxNumberOfAgents,
            options.batchName,
            options.globalVariablesOverrides,
            options.variablesOverridesPerTest,
            options.gatewayName,
        );
        const spinner = yoctoSpinner({ text: 'Waiting for batch results...' });

        let batchStatus: CTRFReport;
        let lastChangeOfPendingTests: Date | null = new Date();
        let previousNumberOfPendingTests: number = Number.MAX_SAFE_INTEGER;

        spinner.start();
        do {
            await sleep(parseInt(options.pollPeriod));
            batchStatus = await getBatchStatus(options.aivaUrl, options.apiKey, batchId);
            if (options.verbose) console.debug(JSON.stringify(batchStatus, null, 4));
            lastChangeOfPendingTests = isBatchProgressing(previousNumberOfPendingTests, lastChangeOfPendingTests, options.testProgressTimeout, batchStatus);
        } while (isTestBatchRunning(batchStatus));
        spinner.stop();

        log_batch_results(batchStatus);
        if (isBatchFailed(batchStatus)) {
            console.error('AIVA test batch has failed tests or tests that failed to start.');
        }
        await writeFile(options.resultPath, JSON.stringify(batchStatus), 'utf-8');
    });

program.parseAsync();
