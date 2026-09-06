import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeModels,
  reasoningOptions,
  completionOptions,
} from "./models.js";

test("catalog excludes batch and non-text models and respects mandatory reasoning", () => {
  const base = {
    id: "openai/test",
    name: "OpenAI: Test",
    architecture: { output_modalities: ["text"] },
    supported_parameters: ["response_format"],
    reasoning: { mandatory: true, supported_efforts: ["high", "low", "none"] },
  };
  const models = normalizeModels([
    base,
    { ...base, id: "openai/test:batch" },
    { ...base, id: "other/test" },
    { ...base, architecture: { output_modalities: ["image"] } },
  ]);
  assert.equal(models.length, 1);
  assert.deepEqual(models[0].efforts, ["high", "low"]);
  assert.throws(() => reasoningOptions(models[0], "none"), /does not support/);
  assert.deepEqual(reasoningOptions(models[0], "low"), {
    reasoning: { effort: "low", exclude: true },
  });
  assert.deepEqual(reasoningOptions(models[0], "default"), {});
  assert.throws(() => reasoningOptions(undefined, "high"), /does not support/);
});
test("reasoning requests have room for both reasoning and the answer within model limit", () => {
  const model = { efforts: ["high", "none"], maxOutput: 12000 };
  assert.deepEqual(completionOptions(model, "high"), {
    reasoning: { effort: "high", exclude: true },
    max_tokens: 12000,
  });
  assert.equal(completionOptions(model, "none").max_tokens, 2500);
  assert.equal(completionOptions(model, "default").max_tokens, 12000);
});
