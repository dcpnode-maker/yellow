# Personal notebook hardware probe

`hardware_probe.py` reports CPU count/RAM, optional installed PyTorch CUDA or
JAX TPU devices, and one 128×128 synthetic multiplication. It makes no network
requests and reads no credentials, hotel data, Yellow source or private inputs.
The printed JSON is a capability receipt, not a model-quality benchmark.

Run `hardware_probe.py` locally, or paste `kaggle_gpu_cell.py` or
`kaggle_tpu_cell.py` into a private Kaggle code cell for the matching
accelerator startup check. Select one free accelerator, run the cell, record
its output, then stop the draft session. A queued session is not proof of
hardware availability. Do not set Save &
Run All or publish notebook output. Avoid placing
real property/guest records, private source or tokens in the notebook.

```powershell
python -m unittest discover -s tools/yellow-harness/probes -p 'test_*.py' -v
python tools/yellow-harness/probes/hardware_probe.py
```

The first CUDA/JAX initialization and compilation is included in the reported
time, so `tiny_matmul_ms` does **not** measure steady-state inference speed.
