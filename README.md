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

## Development
Just clone [the repository](https://github.com/aiva-actions/run)

```shell
git clone 
```