#!/usr/bin/env bun

import { run } from "./scanlib/core.ts";

process.exitCode = await run();
