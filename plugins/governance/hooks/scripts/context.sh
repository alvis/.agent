#!/usr/bin/env bash
# Governance plugin context - currently no additional context needed
# Compatible with bash 3.2+

get_plugin_context() {
  local context=""

  # Agent Capabilities
  local agent_capabilities=""

  # Detect Agent Teams support
  if [[ "${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-}" == "1" ]]; then
    agent_capabilities+="**Agent Teams**: enabled\n"
  fi

  # Only add section if any capabilities detected
  if [[ -n "$agent_capabilities" ]]; then
    context+="## Agent Capabilities\n\n"
    context+="$agent_capabilities"
    context+="\n"
  fi

  echo -n "$context"
}
