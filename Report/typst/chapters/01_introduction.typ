#import "../template.typ": *

= Introduction

== Background <intro-background>

Compressor Simulator is a desktop application that models the process response of a
three-stage reciprocating gas compressor package and exposes that model over OPC UA,
so a real PLC — CODESYS running on a laptop, or a physical control panel — can be
connected and its control logic exercised against realistic process behaviour
without touching real machinery.

The application contains no control logic of its own: no timers, no permissives, no
state machines, no PID loops, no alarm evaluation. It produces the pressures,
temperatures, flows and speeds a real skid would produce in response to the commands
it receives; deciding what those values mean, running the startup/shutdown sequence,
and evaluating alarms and trips is the PLC's job, exactly as it would be against the
physical unit. This division is deliberate: whatever passes here is exercising the
actual control logic under test, not a simplified stand-in for it.

== Objectives

This report has three objectives:

+ Document how to install the packaged desktop build on a bench or site laptop,
  end to end, from a distributed zip file to a running application.
+ Demonstrate, with a live worked example, how the simulator connects to a CODESYS
  PLC over OPC UA — both locally and over a network — and prove the link is
  genuinely bidirectional rather than merely "connected" in name.
+ Survey the simulator's operating features (manual overrides, fault injection,
  live trending) in enough depth that a new user can locate and use them without
  trial and error.

== Scope

This report covers the packaged desktop build of Compressor Simulator as installed
and operated by an end user; it does not cover the application's internal source
code, the physics model's governing equations, or the CODESYS control logic's
internal implementation. Screenshots and worked examples throughout were captured
against a CODESYS Control Win V3 x64 soft-PLC running project `pi_opc_test.project`
(CODESYS V3.5 SP22 Patch 1) — a bench/development setup, not a certified site panel.
