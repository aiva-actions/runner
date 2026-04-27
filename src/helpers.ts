import type { CTRFReport, Summary, Test } from 'ctrf';
import { InvalidOptionArgumentError } from '@commander-js/extra-typings';

/** @param {string} labelsInput
 * @param dummyPrevious
 */
export function parseLabels(labelsInput: string, dummyPrevious: string[]): string[]{
    if (labelsInput.length == 0) {
        throw new InvalidOptionArgumentError('Choose at least one label to execute tests.');
    }
    const labels: string[] = labelsInput
        .split(';')
        .map((s: string): string => s.trim())
        .filter((label: string) => label.length > 0);

    if (labels.length === 0) {
        throw new Error('At least one non-empty label must be specified.');
    }
    return labels;
}

export function validateAivaKey(key:string , dummyPrevious: string): string {
    if (key.length == 0) {
        throw new InvalidOptionArgumentError('Add an AIVA API Key via "-k <API_KEY>, so you can access the AIVA API.');
    }
    if (!key.includes('aiva_')) {
        throw new InvalidOptionArgumentError('Incorrect format of AIVA API Key. Correct format: "aiva_..."');
    }
    return key
}

/**
 * @param seconds How long to sleep for in seconds.
 */
export function sleep(seconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

/**
 * @param batchStatusResponse
 * @returns {Boolean} True if there are no more pending tests
 */
export function isTestBatchRunning(batchStatusResponse: CTRFReport): boolean {
    const pending: number = batchStatusResponse?.results?.summary?.pending ?? 0;
    return pending > 0;
}

export function validateBatchProgress(
    previousNumberOfPendingTests: number,
    changeTimeOfPendingTests: Date | null,
    batchProgressTimeout: number,
    batchStatusResponse: CTRFReport,
): Date | null {
    const currentTime = new Date();
    if (changeTimeOfPendingTests == null) {
        changeTimeOfPendingTests = new Date();
    }
    if (batchStatusResponse?.results?.summary?.pending < previousNumberOfPendingTests) {
        return new Date();
        // "+" before Date due to https://github.com/Microsoft/TypeScript/issues/5710
    } else if (+currentTime - +changeTimeOfPendingTests > batchProgressTimeout * 1000) {
        throw new Error('Timeout waiting for pending tests.');
    } else {
        return null;
    }
}

export function isValueInRange(value: number, minValue: number, maxValue: number): boolean {
    return minValue <= value && value <= maxValue;
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

export function logBatchResults(batchResults: CTRFReport): void {
    const summary: Summary = batchResults.results.summary;
    const startMs: number | undefined = summary.start;
    const stopMs: number | undefined = summary.stop;
    const duration: string = startMs !== undefined && stopMs !== undefined ? formatEpochDurationMs(startMs, stopMs) : 'n/a';
    const logLine = `Total: ${summary.tests}, Passed: ${summary.passed}, Failed: ${summary.failed}, Skipped: ${summary.skipped}, Duration: ${duration}`;
    console.log(logLine);
}

export function isBatchFailed(batchStatus: CTRFReport): boolean {
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
