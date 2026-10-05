# First coding-model smoke

The official [Qwen2.5-Coder-1.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct)
weights are Apache-2.0. `kaggle_smoke.py` pins revision
`2e1fd397ee46e1388853d2af2c993145b0f1098a`, uses an entirely synthetic
Python prompt, caps output at 240 tokens and prints a JSON receipt. It neither
executes the generated text nor edits Yellow. This small model proves the
inference path; it is **not** selected as Yellow's best coding worker by one run.

The first use downloads public model files from Hugging Face into Kaggle's
ephemeral environment, so run only in the founder-authorized personal,
non-commercial test session. Stop that session after recording the result.

```powershell
python -m unittest discover -s tools/yellow-harness/model-eval -p 'test_*.py' -v
```
