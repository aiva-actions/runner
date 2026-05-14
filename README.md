# runner

Typescript CLI tool for running tests in AIVA. Primarily aimed to be used in CI tools.

## What this tool does
1. Starts a test batch from tests labeled with the labels you define
2. Keeps monitoring the run and it's progress
3. Writes a test run summary to a file to be used by CI.

## Installation
```shell
npm install github:aiva-actions/runner#initial-version
```

## Usage
```shell
npx runner --help

npx runner -l some;labels -k <AIVA_API_KEY>
```

### Input options

| Option | Description | Default |
| --- | --- | --- |
| `-V`, `--version` | Output the version number. | — |
| `-k`, `--api-key <key>` | AIVA API key. | `""` |
| `-l`, `--labels <labels>` | Semicolon-separated labels that select which tests run (e.g. `smoke;regression`). At least one non-empty label is required after splitting. | — |
| `-n`, `--max-number-of-agents <number>` | Optional. Maximum number of agents the batch may use. | `"1"` |
| `-b`, `--batch-name <name>` | Optional. Custom batch name. | `""` |
| `--global-variables-overrides <JSON>` | Optional. JSON object applied to all tests in the batch, e.g. `{"username": "testuser"}`. | `"{}"` |
| `--variables-overrides-per-test <JSON>` | Optional. JSON object mapping test IDs to variable overrides, e.g. `{"123e4567-e89b-12d3-a456-426614174000": { "user": "otheruser", "label": "success" }}`. | `"{}"` |
| `-g`, `--gateway-name <gateway-name>` | Optional. Gateway name used by aiva-node during the test. | — |
| `-p`, `--poll-period <seconds>` | Optional. Seconds to wait between status polls. Must be between 5 and 60. | `"10"` |
| `-u`, `--aiva-url <URL>` | Optional. Batch API URL: `POST` to start the batch, `GET {url}/{batchId}` for status polling. | `https://api.aiva.works/` |
| `-F`, `--result-format <format>` | Optional. Format of the batch status result (choices: `ctrf`, `junit`). | — |
| `-f`, `--result-path <filepath>` | Optional. Path where the final CTRF or JUnit is written and uploaded as the batch-status artifact. | `./batch-results.json` |
| `-v`, `--verbose` | Optional. Display verbose (debug) output. | — |
| `-h`, `--help` | Display help for the command. | — |

## Library usage
You can also import helpers and API functions from the package:

```ts
import { executeBatch, waitForBatchCompleted, parseLabels } from 'runner';
```

## Development
Just clone [the repository](https://github.com/aiva-actions/run)

```shell
git clone 
```