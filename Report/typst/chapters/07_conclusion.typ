#import "../template.typ": *

= Conclusion and Future Improvements

This report has documented, with a screenshot for every meaningful step, how to
install Compressor Simulator, how to connect it to a CODESYS PLC over OPC UA in
both local and networked configurations, and how to verify that connection is
genuinely live rather than merely reporting "connected." It has also surveyed the
simulator's Overrides, Faults, Tags and Engineering Trends features in enough
depth for a new user to locate and use each one without trial and error. Taken
together, the report supports its stated objectives (@intro-background): a reader
starting from nothing should be able to reach a PLC-driven, faulted, trending
simulation using this document alone.

== Future Improvements

- *Full-window Faults screenshots.* Replace the cropped panel captures used for
  @features's Faults subsections with full-window screenshots matching the style
  used in @opc-connection, so a reader can place each control within the overall
  layout without the live app open alongside this report.
- *A second verification pair for an analog tag.* The @verify-link test proves a
  discrete (boolean) tag round-trips correctly; a matching before/after pair for an
  analog command (e.g. `SC_3001`, engine speed) would demonstrate that scaled
  numeric values, not just on/off signals, survive the OPC UA link intact.
- *Appendix expansion.* Appendix A currently lists only the tags referenced
  directly in this report's figures. A future revision could pull the simulator's
  complete tag list from its own Tags-tab export (@features) rather than
  transcribing it from screenshots, guaranteeing it stays in sync with the running
  application.
- *Automated regeneration.* Wire this report's build into the same process that
  produces a new installer build, so a version bump (or a change to the simulator's
  UI) triggers a reminder to re-capture any screenshot that shows a version string,
  IP address, or UI element that may have moved.
