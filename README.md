# IAM Harvest
Harvests AWS IAM Metadata and publishes to different libraries to assist with automation.

## Status
[![Build Status](https://github.com/act-security-labs/iam-harvest/actions/workflows/update-packages.yml/badge.svg)](https://github.com/act-security-labs/iam-harvest/actions/workflows/update-packages.yml)

### Packages
This publishes to three different packages nightly **if there are changes to the data**:

|Runtime|Github|Package|
|----------|:--------|:---------|
|Node/Browser|[iam-data](https://github.com/act-security-labs/iam-data)| [@actsecurity/iam-data](https://www.npmjs.com/package/@actsecurity/iam-data)|
|Go|[iam-data-go](https://github.com/act-security-labs/iam-data-go)|[iam-data-go](https://pkg.go.dev/github.com/act-security-labs/iam-data-go/iamdata)|
|Python|[iam-data-python](https://github.com/act-security-labs/iam-data-python)|[iamdata](https://pypi.org/project/iamdata/)|
