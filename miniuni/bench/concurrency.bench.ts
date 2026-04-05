import assert from 'node:assert/strict';
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

const ROOT_DIR = '/concurrency_benchmarks';

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
      const result = await compiled(newContext());
      assert.deepStrictEqual(result, expected);
      return result;
    },
  };
};

const syncFanOutBenchmark = compileBenchmarkProgram(
  'sync packet fan-out',
  `
    import "std/concurrency" as { sync }

    expected := 200
    done := (id: 0, chan: channel("done"))
    router := (id: 0, chan: channel("router"))

    sync {
      async {
        mut received := 0
        loop {
          if received == expected do break ()
          <- router.chan
          received++
        }
        done.chan <- received
      }

      mut i := 0
      loop {
        if i == expected do break ()
        async { router.chan <- i };
        i++
      }

      <- done.chan
    }
  `,
  200
);

const pipeForwardingBenchmark = compileBenchmarkProgram(
  'pipe forwarding',
  `
    import "std/concurrency" as { pipe, sync }

    expected := 200
    done := (id: 0, chan: channel("done"))
    target := (id: 1, chan: channel("target"))
    source := (id: 0, chan: pipe (channel "source") target.chan)

    sync {
      async {
        mut received := 0
        loop {
          if received == expected do break ()
          <- target.chan
          received++
        }
        done.chan <- received
      }

      mut i := 0
      loop {
        if i == expected do break ()
        source.chan <- i
        i++
      }

      close source.chan
      <- done.chan
    }
  `,
  200
);

const directRouterForwardingBenchmark = compileBenchmarkProgram(
  'router direct forwarding',
  `
    import "std/concurrency" as { sync }

    create_packet := fn (id, target_id) { id: id, target_id: target_id }

    create_target_router := fn (id, expected, done) {
      router := (id: id, chan: channel("target"))

      async {
        mut handled := 0
        loop {
          if handled == expected do break ()
          switch <- router.chan {
            { target_id: ^id } -> handled++
          }
        }
        done.chan <- handled
      }

      router
    }

    create_forwarder := fn (target_chan, expected) {
      router := (id: 0, chan: channel("source"))

      async {
        mut routed := 0
        loop {
          if routed == expected do break ()
          packet := <- router.chan
          async { target_chan.chan <- packet };
          routed++
        }
      }

      router
    }

    expected := 200
    done := (id: 0, chan: channel("done"))
    target := create_target_router(1, expected, done)
    source := create_forwarder(target, expected)

    sync {
      mut i := 0
      loop {
        if i == expected do break ()
        async { source.chan <- create_packet(i, 1) };
        i++
      }

      <- done.chan
    }
  `,
  200
);

const pendingTargetRerouteBenchmark = compileBenchmarkProgram(
  'pending target reroute',
  `
    import "std/concurrency" as { sync, wait }

    create_packet := fn (id, target_id) { id: id, target_id: target_id }

    expected := 200
    done := (id: 0, chan: channel("done"))
    busy_target := (id: 1, chan: channel("busy target"))
    fallback := (id: 2, chan: channel("fallback"))

    sync {
      async { busy_target.chan <- create_packet(-1, 1) };

      loop {
        if busy_target.chan.status == :pending do break ()
        wait 0
      }

      async {
        mut received := 0
        loop {
          if received == expected do break ()
          <- fallback.chan
          received++
        }
        done.chan <- received
      }

      mut i := 0
      loop {
        if i == expected do break ()
        packet := create_packet(i, 1)

        if busy_target.chan.status == :pending {
          loop {
            if fallback.chan.status != :pending {
              async { fallback.chan <- packet };
              break ()
            }
          }
        } else {
          async { busy_target.chan <- packet };
        }

        i++
      }

      routed := <- done.chan
      <- busy_target.chan
      routed
    }
  `,
  200
);

const benchmarks = [
  syncFanOutBenchmark,
  pipeForwardingBenchmark,
  directRouterForwardingBenchmark,
  pendingTargetRerouteBenchmark,
];

describe('concurrency benchmark', () => {
  for (const benchmarkProgram of benchmarks) {
    bench(benchmarkProgram.name, async () => {
      await benchmarkProgram.run();
    });
  }
});
