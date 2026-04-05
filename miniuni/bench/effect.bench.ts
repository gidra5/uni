import { bench, describe } from 'vitest';
import { FileMap } from 'codespan-napi';
import { Injectable, register } from '../src/injector.ts';
import { addFile } from '../src/files.ts';
import {
  compileScript,
  newCompileContext,
  newContext,
  type Executable,
} from '../src/evaluate/index.ts';
import { parseTokens } from '../src/tokens.ts';
import { parseScript } from '../src/parser.ts';
import type { EvalValue } from '../src/values.ts';

const createDeepNestingProgram = (
  depth: number,
  iterations: number
): string => {
  let body = `
    get_a := fn { handle (:a) () }

    mut i := 0
    mut sum := 0
    loop {
      if i == ${iterations} do break sum
      sum += get_a()
      i++
    }
  `;

  for (let i = 0; i < depth; i++) {
    body = `
      inject depth_${i}: ${i} {
        mask :masked_${i} {
          without () {
            ${body}
          }
        }
      }
    `;
  }

  return `
    inject a: 1 {
      ${body}
    }
  `;
};

const ROOT_DIR = '/effect_benchmarks';

register(Injectable.FileMap, new FileMap());
register(Injectable.RootDir, ROOT_DIR);

type BenchmarkProgram = {
  name: string;
  expected: EvalValue;
  run: () => Promise<EvalValue>;
};

const compileBenchmarkProgram = (
  name: string,
  input: string,
  expected: EvalValue
): BenchmarkProgram => {
  const file = `${ROOT_DIR}/${name}.uni`;
  const fileId = addFile(file, input);
  const compileContext = newCompileContext(fileId, file);
  const tokens = parseTokens(input);
  const ast = parseScript(tokens);
  const compiled: Executable = compileScript(ast, compileContext);

  return {
    name,
    expected,
    run: async () => {
      const context = newContext();
      return await compiled(context);
    },
  };
};

const plainInjectedValueLookupBenchmark = compileBenchmarkProgram(
  'plain injected value lookup',
  `
    get_a := fn { handle (:a) () }

    inject a: 1 {
      mut i := 0
      mut sum := 0
      loop {
        if i == 200 do break sum
        sum += get_a()
        i++
      }
    }
  `,
  200
);

const singleShotHandlerResumeBenchmark = compileBenchmarkProgram(
  'single-shot handler resume',
  `
    choose := :choose |> handle
    run_once := fn {
      value := choose(1)
      value + 1
    }

    inject choose: handler fn (callback, value) do callback(value) {
      mut i := 0
      mut sum := 0
      loop {
        if i == 100 do break sum
        sum += run_once()
        i++
      }
    }
  `,
  200
);

const multiShotHandlerResumeBenchmark = compileBenchmarkProgram(
  'multi-shot handler resume',
  `
    step := :step |> handle
    run_once := fn {
      inject step: handler fn (callback, _) {
        left := callback()
        right := callback()
        left + right
      } {
        mut local := 1
        step()
        local++
        local
      }
    }

    mut i := 0
    mut sum := 0
    loop {
      if i == 10 do break sum
      sum += run_once()
      i++
    }
  `,
  40
);

const deepNestingBenchmark = compileBenchmarkProgram(
  'deep nesting of inject/mask/without',
  createDeepNestingProgram(12, 40),
  40
);

describe('effect handlers benchmark', () => {
  bench(plainInjectedValueLookupBenchmark.name, async () => {
    await plainInjectedValueLookupBenchmark.run();
  });

  bench(singleShotHandlerResumeBenchmark.name, async () => {
    await singleShotHandlerResumeBenchmark.run();
  });

  bench(multiShotHandlerResumeBenchmark.name, async () => {
    await multiShotHandlerResumeBenchmark.run();
  });

  bench(deepNestingBenchmark.name, async () => {
    await deepNestingBenchmark.run();
  });
});
