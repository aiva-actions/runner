import type { CTRFReport } from 'ctrf';
import { AIVAErrorResponse, sleep } from './helpers.js';
import { GET_BATCH_STATUS_RETRY_DELAY_SECONDS } from './constants.js';

export interface RunTestBatchResponse {
    testBatchId: string;
}

/**
 * @param {Request | string | URL} apiUrl
 * @param {string} apiKey
 * @param {string[]} labels
 * @param {string} maxNumberOfAgents
 * @param {string} batchName
 * @param {object} globalVariableOverrides
 * @param {object} variableOverridesPerTest
 * @param {string} gatewayName
 * @returns object batchID of the newly created batch in AIVA
 */
export async function executeBatch(
    apiUrl: string,
    apiKey: string,
    labels: string[] | undefined,
    maxNumberOfAgents: string,
    batchName: string,
    globalVariableOverrides: object | undefined,
    variableOverridesPerTest: object | undefined,
    gatewayName: string | undefined,
): Promise<RunTestBatchResponse> {
    console.log('Executing test batch with following parameters');
    let res: Response;

    try {
        res = await fetch(new URL('/v1/batches', apiUrl), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-API-Key': apiKey,
            },
            body: JSON.stringify({
                name: batchName,
                labels: labels,
                maxNumberOfAgents: maxNumberOfAgents,
                globalVariablesOverrides: globalVariableOverrides,
                variablesOverridesPerTest: variableOverridesPerTest,
                gatewayName: gatewayName,
            }),
        });
    } catch (err) {
        throw new Error(`Fetch failed during executing of batch, URI ${apiUrl} not reachable : ${err instanceof Error ? err.message : 'unknown'}`, {
            cause: err,
        });
    }
    if (!res.ok) {
        throw new Error(`AIVA batch request failed (${res.status}, ${await res.text()})`);
    }
    console.log(`AIVA batch started`);

    return (await res.json()) as RunTestBatchResponse;
}

/**
 * @param {string} apiUrl
 * @param {string} apiKey
 * @param {string} batchId
 * @param format
 * @returns {CTRFReport} object in CTRFReport format
 */
export async function getBatchStatusRaw(apiUrl: string, apiKey: string, batchId: string, format: 'ctrf' | 'junit' | undefined): Promise<string> {
    let res: Response;
    try {
        res = await fetch(new URL(`/v1/batches/${batchId}`, apiUrl), {
            method: 'GET',
            headers: {
                Accept: format == 'junit' ? 'application/xml' : 'application/json',
                'X-API-Key': apiKey,
            },
        });
    } catch (err) {
        throw new Error(`Fetch failed during checking of Batch status, URI ${apiUrl} not reachable : ${err instanceof Error ? err.message : 'unknown'}`, {
            cause: err,
        });
    }
    if (!res.ok) {
        const errText = (await res.json()) as AIVAErrorResponse;
        throw new Error(`Batch status request failed (${res.status}): ${errText.errors}`);
    }
    return await res.text();
}

export async function getBatchStatus(aivaUrl: string, apiKey: string, batchId: string): Promise<CTRFReport> {
    let batchStatus: string;
    try {
        batchStatus = await getBatchStatusRaw(aivaUrl, apiKey, batchId, 'ctrf');
    } catch {
        await sleep(GET_BATCH_STATUS_RETRY_DELAY_SECONDS);
        batchStatus = await getBatchStatusRaw(aivaUrl, apiKey, batchId, 'ctrf');
    }
    return JSON.parse(batchStatus);
}
