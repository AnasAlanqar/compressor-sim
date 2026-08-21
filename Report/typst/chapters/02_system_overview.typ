#import "../template.typ": *

= System Overview

== Reference Machine

#kv-table((
  ("Compressor", "Ariel JGH/4, three-stage reciprocating"),
  ("Driver", "Caterpillar G3516LE gas engine"),
  ("Panel", "Spartan Controls REMVue 500S"),
  ("Unit", "Enerflex 070438, project PN17481"),
))

== Architecture

The application is split into a browser-based front end and a Python backend
running in the same desktop process (via a WebView shell). The front end renders an
animated P&ID, live gauges and trend charts, driven by a 10 Hz WebSocket state push
from the backend. The backend runs a fixed-step physics integrator (RK4, 20 ms
step) that produces the process state, and an OPC UA client (`asyncua`) that reads
PLC commands into that model and writes the model's measurements back out to the
PLC.

- *Front end* — React + TypeScript + Vite, rendered inside a native window via
  `pywebview`.
- *Backend* — FastAPI + asyncio, hosting the physics loop and the OPC UA client.
- *PLC link* — the simulator is always the OPC UA _client_; the PLC (CODESYS or a
  physical panel) runs the OPC UA _server_. This direction is deliberate — CODESYS's
  own OPC UA client requires separate licensing on some versions, so having the
  simulator act as client is the configuration that works everywhere without extra
  cost.
