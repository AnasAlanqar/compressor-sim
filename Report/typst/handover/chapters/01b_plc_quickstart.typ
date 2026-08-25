#import "../../template.typ": *

= PLC Engineer Quick Start <sec-quickstart>

This section is the whole system in a few minutes: what the simulator does, what it does not do,
and where the boundary between the two sits. Everything here is expanded, with the underlying
physics and full procedures, later in the report — the cross-references point to where.

== What You Are Responsible For

#note(label: "KEY MESSAGE")[
  The simulator does not contain the PLC sequence you are supposed to develop. It has no
  startup/shutdown state machine, no permissives, no timers, and no alarm or trip evaluation of
  its own (@sec-purpose). It produces the process response defined by the implemented simulator
  model for the commands it receives.
]

#data-table(
  ([Simulator responsibilities], [PLC responsibilities]),
  (
    ([
      - Process pressures (suction, stage, final discharge)
      - Compressor mass-flow response
      - Temperature response (cylinder, oil, aftercooler, jacket water)
      - Engine-speed response (crank / accelerate / decelerate / coastdown)
      - Valve-position dynamics (rate-limited, per-valve fail direction)
      - Lubrication-pressure response (prelube and running)
      - Simulated limit switches / status feedback
      - Transmitter values, including range clamping
      - Injected physical/instrument faults (@sec-faults)
      - OPC UA tag exchange with the PLC (Appendix A)
    ],
    [
      - Startup sequence
      - Normal stop sequence
      - Unconditional shutdown (USD) sequence
      - Permissives
      - Interlocks
      - Timers
      - State machine / sequencer
      - Engine-start logic
      - Prelube logic
      - Valve sequencing
      - Cooler sequencing
      - Loading / unloading logic
      - Alarm evaluation
      - Trip evaluation
      - Watchdog / link supervision
      - Reset philosophy
      - HMI/operator logic, where applicable
    ]),
  )
)

== System Boundary

#let sysbox(title, subtitle, lines, dashed: false) = box(
  stroke: (if dashed {
    (paint: rule-color, thickness: 0.9pt, dash: "dashed")
  } else {
    0.8pt + rule-color
  }),
  inset: 10pt, radius: 2pt, width: 3.4in,
)[
  #align(center)[
    #text(weight: "bold", size: 10.5pt)[#title]
    #if subtitle != none [
      #v(1pt)
      #text(size: 7.5pt, style: "italic", fill: muted)[#subtitle]
    ]
    #v(4pt)
    #line(length: 100%, stroke: 0.4pt + rule-color)
    #v(6pt)
    #set text(size: 9pt)
    #for (i, l) in lines.enumerate() [
      #l #if i < lines.len() - 1 [ \ ]
    ]
  ]
]

#let flowlabel(body) = text(size: 8.5pt, style: "italic", fill: muted)[#body]
#let opculabel = text(size: 7.5pt, weight: "bold", fill: muted)[OPC UA]

#figure(
  block(breakable: false)[
    #align(center)[
      #sysbox("PLC / CODESYS", "Real control logic (not simulated)", (
        "Sequence", "Permissives", "Interlocks", "Alarms / Trips", "Package Control Logic",
      ))
      #v(8pt)
      #grid(
        columns: (1fr, 1fr), gutter: 10pt,
        align(center)[
          #flowlabel[Commands / Outputs]
          #v(2pt)
          #text(size: 16pt)[$arrow.b$]
          #v(2pt)
          #opculabel
        ],
        align(center)[
          #flowlabel[Measurements / Status]
          #v(2pt)
          #text(size: 16pt)[$arrow.t$]
          #v(2pt)
          #opculabel
        ],
      )
      #v(8pt)
      #sysbox("Compressor Simulator", "Simulated physical plant (software model)", (
        "Process physics", "Engine response", "Valve dynamics", "Instrument model", "Fault injection",
      ), dashed: true)
    ]
  ],
  caption: [System boundary. The dashed border marks the simulation boundary: everything inside
    the Compressor Simulator block is a software model of the physical plant, not real equipment.
    The PLC / CODESYS block is the real control logic under test and owns sequence, permissives,
    interlocks, alarms/trips, and package control logic; the simulator owns process physics and
    engine/valve/instrument response. Commands flow down and measurements/status flow back up,
    both over the same OPC UA link.],
) <fig-system-boundary>

Commands flow down (Appendix A, "Commands In"); measurements and status flow back up
(Appendix A, "Measurements Out"). Both directions of this loop are carried over the same OPC UA
link (@opc-connection).

== Recommended Reading Path

See @sec-purpose, "How to Use This Report," for the full reading order for PLC development versus
model review/verification. In short: read this Quick Start, @sec-background, and @sec-process, then go
straight to @sec-roadmap and start wiring up communications — the detailed governing equations
(@sec-equations) are reference material, not a prerequisite.

== Do Not Confuse

#note(label: "THE SIMULATOR IS NOT THE SEQUENCER")[
  It supplies process physics only. The startup/shutdown state machine is entirely the connected
  PLC's responsibility (@sec-running).
]

#note(label: "FAULTS ARE INJECTED LOCALLY")[
  Simulator faults (@sec-faults) are never exposed on OPC UA as "a fault is active." The PLC sees
  the injected condition only through its *effect* on process/instrument tags; no separate
  simulator-fault indication is exposed through the normal PLC interface unless specifically
  documented.
]

#note(label: "SIMULATION VALUES ARE NOT VENDOR PERFORMANCE GUARANTEES")[
  The design point (@sec-constants) is a plausible reference point for a generic package, not a
  measured or validated real-machine performance curve (@sec-limitations).
]

#note(label: "THE PROCESS MODEL IS INTENTIONALLY SIMPLIFIED")[
  Ideal gas, no choked flow, no cylinder thermal mass, no heat-exchanger model, no engine torque
  coupling (@sec-limitations) — sufficient for PLC logic testing, not for performance,
  mechanical, or thermal design work.
]

#note(label: "A WORKING OPC UA LINK DOES NOT PROVE PLC LOGIC IS CORRECT")[
  It confirms communication for the tested signal path (@verify-link, @sec-commissioning).
  Sequence correctness is a separate validation step (@sec-commissioning).
]

#note(label: "A WORKING MANUAL SEQUENCE VIA OVERRIDES DOES NOT PROVE THE AUTOMATIC PLC STATE MACHINE IS CORRECT")[
  Driving tags by hand from the Overrides dock (@sec-interface) only demonstrates the simulator's
  implemented response to that command — it says nothing about whether the PLC would have issued
  that command, in that order, on its own.
]

#note(label: "THE PREDECESSOR SEQUENCE IS A REFERENCE, NOT AN ENFORCEMENT MECHANISM")[
  The state diagram in @sec-running is one valid control philosophy from an earlier rig, included
  for orientation. This simulator enforces none of its states or transitions.
]
