import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fc from 'fast-check';
import { record, readConfigureGlobal } from 'fast-check';
import { getCurrentTest } from 'vitest/suite';
import { it as itVitest, test as testVitest } from 'vitest';
import {
  loadRegressionCases,
  saveRegressionCases,
  type RegressionCase,
} from './regressionStorage.js';
import { isVitestSnapshotUpdateEnabled } from './vitestSnapshotMode.js';

export { fc };

export type PropertyContext = {
  regressionRoot: string;
  sourceFile: string;
  propertyPath: string[];
};

type RunPropertyOptions = {
  context?: PropertyContext;
  params?: fc.Parameters<any>;
  updateMode?: boolean;
};

type ArbitraryTuple<Ts extends [any] | any[]> = {
  [P in keyof Ts]: fc.Arbitrary<Ts[P]>;
};

type ArbitraryRecord<Ts> = {
  [P in keyof Ts]: fc.Arbitrary<Ts[P]>;
};

type Prop<Ts extends [any] | any[]> = (
  ...args: Ts
) => boolean | void | PromiseLike<boolean | void>;

type PropRecord<Ts> = (arg: Ts) => boolean | void | PromiseLike<boolean | void>;

type TestProp = <Ts, TsParameters extends Ts = Ts>(
  arbitraries: Ts extends [any] | any[] ? ArbitraryTuple<Ts> : ArbitraryRecord<Ts>,
  params?: fc.Parameters<TsParameters>
) => (
  testName: string,
  prop: Ts extends [any] | any[] ? Prop<Ts> : PropRecord<Ts>,
  timeout?: number | undefined
) => void;

export type FastCheckItBuilder<T> = T &
  ('each' extends keyof T ? T & { prop: TestProp } : T) & {
    [K in keyof Omit<T, 'each'>]: FastCheckItBuilder<T[K]>;
  };

type It = typeof itVitest;

const projectRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const defaultRegressionRoot = resolve(
  fileURLToPath(new URL('../../tests/__regressions__/', import.meta.url))
);
const seedSuffix = /\s+\(with seed=-?\d+\)$/;

const stripSeedSuffix = (name: string) => name.replace(seedSuffix, '');

const normalizePath = (path: string) => path.replaceAll('\\', '/');

const buildPropertyPath = (task: any) => {
  const names = [stripSeedSuffix(task.name)];
  let currentSuite = task.suite;

  while (currentSuite && currentSuite !== task.file) {
    names.unshift(currentSuite.name);
    currentSuite = currentSuite.suite;
  }

  return names;
};

const currentPropertyContext = (): PropertyContext => {
  const task = getCurrentTest<any>();
  if (!task) {
    throw new Error('fast-check regression adapter requires a running Vitest test');
  }

  return {
    regressionRoot: defaultRegressionRoot,
    sourceFile: normalizePath(relative(projectRoot, task.file.filepath)),
    propertyPath: buildPropertyPath(task),
  };
};

const toStoredCase = (result: fc.RunDetails<any[]>): RegressionCase | null => {
  if (!result.failed || result.counterexamplePath == null) return null;
  return {
    seed: result.seed,
    path: result.counterexamplePath,
  };
};

const buildError = async (
  result: fc.RunDetails<any>,
  params: fc.Parameters<any> | undefined
) => {
  const message =
    (await fc.asyncDefaultReportMessage(result as any)) ?? 'Property failed';

  if (!params?.errorWithCause) {
    return new Error(message);
  }

  const error = new Error(message, { cause: result.errorInstance });
  if (!('cause' in error)) {
    Object.assign(error, { cause: result.errorInstance });
  }
  return error;
};

const reportRunDetails = async (
  result: fc.RunDetails<any>,
  params: fc.Parameters<any> | undefined
) => {
  if (params?.asyncReporter) {
    await params.asyncReporter(result);
    return;
  }

  if (params?.reporter) {
    params.reporter(result);
    return;
  }

  if (result.failed) {
    throw await buildError(result, params);
  }
};

const replayRegressionCase = async (
  property: fc.IAsyncProperty<any[]>,
  params: fc.Parameters<any> | undefined,
  entry: RegressionCase
) =>
  await fc.check(property, {
    ...params,
    seed: entry.seed,
    path: entry.path,
    numRuns: 1,
    endOnFailure: true,
  });

export const runPropertyWithRegressions = async (
  property: fc.IAsyncProperty<any[]>,
  options: RunPropertyOptions = {}
) => {
  const context = options.context ?? currentPropertyContext();
  const updateMode = options.updateMode ?? isVitestSnapshotUpdateEnabled();
  const storedCases = await loadRegressionCases(
    context.regressionRoot,
    context.sourceFile,
    context.propertyPath
  );

  if (updateMode) {
    const stillFailing: RegressionCase[] = [];
    let firstFailure: fc.RunDetails<any[]> | null = null;

    for (const entry of storedCases) {
      const result = await replayRegressionCase(
        property,
        options.params,
        entry
      );
      const failingCase = toStoredCase(result);

      if (!failingCase) continue;
      stillFailing.push(failingCase);
      firstFailure ??= result;
    }

    if (stillFailing.length > 0) {
      await saveRegressionCases(
        context.regressionRoot,
        context.sourceFile,
        context.propertyPath,
        stillFailing
      );
      await reportRunDetails(firstFailure!, options.params);
      return;
    }
  } else {
    for (const entry of storedCases) {
      const result = await replayRegressionCase(
        property,
        options.params,
        entry
      );

      if (!result.failed) continue;

      await reportRunDetails(result, options.params);
      return;
    }
  }

  const result = await fc.check(property, options.params);
  const failingCase = toStoredCase(result);

  if (updateMode) {
    await saveRegressionCases(
      context.regressionRoot,
      context.sourceFile,
      context.propertyPath,
      failingCase ? [failingCase] : []
    );
  } else if (failingCase) {
    await saveRegressionCases(
      context.regressionRoot,
      context.sourceFile,
      context.propertyPath,
      [...storedCases, failingCase]
    );
  }

  await reportRunDetails(result, options.params);
};

function adaptParametersForRecord(
  parameters: fc.Parameters<any>,
  originalParameters: fc.Parameters<any>
) {
  return {
    ...parameters,
    examples:
      parameters.examples !== undefined
        ? parameters.examples.map((example: any) => example[0])
        : undefined,
    reporter: originalParameters.reporter,
    asyncReporter: originalParameters.asyncReporter,
  };
}

function adaptExecutionTreeForRecord(executionSummary: any[]): any[] {
  return executionSummary.map((summary) => ({
    ...summary,
    value: summary.value[0],
    children: adaptExecutionTreeForRecord(summary.children),
  }));
}

function adaptRunDetailsForRecord(
  runDetails: fc.RunDetails<any[]>,
  originalParameters: fc.Parameters<any>
) {
  return {
    ...runDetails,
    counterexample:
      runDetails.counterexample !== null ? runDetails.counterexample[0] : null,
    failures: runDetails.failures.map((failure: any) => failure[0]),
    executionSummary: adaptExecutionTreeForRecord(runDetails.executionSummary),
    runConfiguration: adaptParametersForRecord(
      runDetails.runConfiguration,
      originalParameters
    ),
  };
}

function buildTestWithPropRunner(
  testFn: It,
  label: string,
  arbitraries: fc.Arbitrary<any>[],
  prop: Prop<any>,
  params: fc.Parameters<any> | undefined,
  timeout: number | undefined
) {
  const customParams = { ...params };

  if (customParams.seed === undefined) {
    const seedFromGlobals = readConfigureGlobal().seed;
    customParams.seed =
      seedFromGlobals !== undefined
        ? seedFromGlobals
        : Date.now() ^ (Math.random() * 0x100000000);
  }

  if (customParams.interruptAfterTimeLimit === undefined) {
    customParams.interruptAfterTimeLimit =
      readConfigureGlobal().interruptAfterTimeLimit;
  }

  const propertyInstance = fc.asyncProperty(
    ...(arbitraries as [fc.Arbitrary<any>, ...fc.Arbitrary<any>[]]),
    (...args: any[]) => Promise.resolve(prop(...args))
  );

  testFn(
    `${label} (with seed=${customParams.seed})`,
    async () => {
      await runPropertyWithRegressions(propertyInstance, {
        params: customParams,
      });
    },
    timeout
  );
}

function buildTestProp(testFn: It): TestProp {
  return ((arbitraries: any, params?: fc.Parameters<any>) => {
    if (Array.isArray(arbitraries)) {
      return (testName: string, prop: Prop<any>, timeout?: number) =>
        buildTestWithPropRunner(testFn, testName, arbitraries, prop, params, timeout);
    }

    return (testName: string, prop: PropRecord<any>, timeout?: number) => {
      const recordArb = record(arbitraries as ArbitraryRecord<any>);
      const recordParams =
        params !== undefined
          ? {
              ...params,
              examples:
                params.examples !== undefined
                  ? params.examples.map((example: any) => [example])
                  : undefined,
              reporter:
                params.reporter !== undefined
                  ? (runDetails: fc.RunDetails<any[]>) =>
                      params.reporter!(
                        adaptRunDetailsForRecord(runDetails, params) as any
                      )
                  : undefined,
              asyncReporter:
                params.asyncReporter !== undefined
                  ? (runDetails: fc.RunDetails<any[]>) =>
                      params.asyncReporter!(
                        adaptRunDetailsForRecord(runDetails, params) as any
                      )
                  : undefined,
            }
          : undefined;

      buildTestWithPropRunner(
        testFn,
        testName,
        [recordArb],
        (value: any) => prop(value),
        recordParams,
        timeout
      );
    };
  }) as TestProp;
}

function enrichWithTestProp<T extends (...args: any[]) => any>(
  testFn: T,
  ancestors = new Set<string>()
): FastCheckItBuilder<T> {
  let hasExtras = false;
  const extraKeys: Record<string, any> = {};

  for (const unsafeKey of Object.getOwnPropertyNames(testFn)) {
    const key = unsafeKey as keyof typeof testFn;
    if (!ancestors.has(String(key)) && typeof testFn[key] === 'function') {
      hasExtras = true;
      extraKeys[key as string] =
        key !== 'each'
          ? enrichWithTestProp(
              testFn[key] as unknown as (...args: any[]) => any,
              new Set([...Array.from(ancestors), String(key)])
            )
          : testFn[key];
    }
  }

  if (!hasExtras) return testFn as FastCheckItBuilder<T>;

  const enriched = ((...args: any[]) => testFn(...args)) as T;
  if ('each' in testFn) {
    extraKeys.prop = buildTestProp(testFn as unknown as It);
  }

  return Object.assign(enriched, extraKeys) as FastCheckItBuilder<T>;
}

export const test: FastCheckItBuilder<It> = enrichWithTestProp(testVitest);
export const it: FastCheckItBuilder<It> = enrichWithTestProp(itVitest);
