# ICA -- Refactor the legacy pricing module

```bash
pip install pytest radon
pytest -q                          # 24 characterization tests, all green
radon cc -s legacy_pricing.py      # record the "before" numbers
radon mi -s legacy_pricing.py
```
Refactor in small steps. Run `pytest -q` after EVERY step and commit each green step.
Keep the public function `calc(t, q, u, d, c=None, w=False)` working (other code calls it).
Do not change any test's expected value. If you believe a behavior is a bug, write it in the
worksheet; fixing it is a separate decision for after the refactor.
