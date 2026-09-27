"""One bounded public-model coding smoke in a private Kaggle notebook.

No Yellow source, account keys, private files or guest data are used. The model
response is printed as an untrusted proposal; this script never executes it.
"""

import json
import time


MODEL_ID = "Qwen/Qwen2.5-Coder-1.5B-Instruct"
REVISION = "2e1fd397ee46e1388853d2af2c993145b0f1098a"
MAX_NEW_TOKENS = 240
PROMPT = (
    "Write only Python code for collapse_ranges(intervals: list[tuple[int, int]]) "
    "-> list[tuple[int, int]]. Reject any range with end < start using ValueError. "
    "Sort and merge overlapping or touching closed integer ranges without "
    "mutating the input. Include two assert tests."
)


def run() -> None:
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    started = time.perf_counter()
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, revision=REVISION)
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID, revision=REVISION, dtype=torch.float16,
        low_cpu_mem_usage=True,
    ).to("cuda:0")
    model.eval()
    loaded = time.perf_counter()
    messages = [{"role": "user", "content": PROMPT}]
    prompt_text = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    tokens = tokenizer([prompt_text], return_tensors="pt").to("cuda:0")
    with torch.inference_mode():
        generated = model.generate(
            **tokens, max_new_tokens=MAX_NEW_TOKENS, do_sample=False,
            pad_token_id=tokenizer.eos_token_id,
        )
    torch.cuda.synchronize()
    finished = time.perf_counter()
    response = tokenizer.decode(
        generated[0, tokens["input_ids"].shape[-1]:], skip_special_tokens=True
    )
    print(json.dumps({
        "schema": "yellow-model-smoke-v1",
        "model": MODEL_ID,
        "revision": REVISION,
        "load_seconds": round(loaded - started, 2),
        "generation_seconds": round(finished - loaded, 2),
        "max_gpu_memory_bytes": torch.cuda.max_memory_allocated(0),
        "prompt": PROMPT,
        "response": response,
    }, ensure_ascii=False))


if __name__ == "__main__":
    run()
