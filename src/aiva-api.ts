import type { CTRFReport } from 'ctrf';

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
export async function executeBatch (
    apiUrl: string,
    apiKey: string,
    labels: string[] | undefined,
    maxNumberOfAgents: string,
    batchName: string,
    globalVariableOverrides: object | null,
    variableOverridesPerTest: object | null,
    gatewayName: string | undefined,
): Promise<RunTestBatchResponse> {
    console.log('Executing test batch containing tests labeled with: ' + labels);

    const res: Response = await fetch(apiUrl, {
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

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`AIVA batch request failed (${res.status}): ${errText}`);
    }

    console.log(`AIVA batch request accepted (${res.status})`);

    const responseJSON: RunTestBatchResponse = (await res.json()) as RunTestBatchResponse;
    const batchId: string = responseJSON.testBatchId;
    if (!batchId) {
        throw new Error('AIVA batch response missing testBatchId');
    }
    return responseJSON;
}

/**
 * @param {string} aivaUrl
 * @param {string} apiKey
 * @param {string} batchId
 * @returns {CTRFReport} object in CTRFReport format
 */
export async function getBatchStatus(aivaUrl: string, apiKey: string, batchId: string): Promise<CTRFReport> {
    const res: Response = await fetch(aivaUrl + '/v1/batches/' + batchId, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'X-API-Key': apiKey,
        },
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Batch status request failed (${res.status}): ${errText}`);
    }
    return (await res.json()) as CTRFReport;
}
