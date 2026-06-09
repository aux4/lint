import { findCommandLine } from "../json-positions.js";
import { extractProfileReferences } from "../profiles.js";

export function validateCircularProfiles(parsed, filePath, ctx) {
  const issues = [];

  if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
    return issues;
  }

  // Build adjacency map: profile -> [profiles it references]
  const graph = new Map();
  const edgeLocations = new Map();

  for (const profile of parsed.profiles) {
    if (!profile.name) continue;
    if (!graph.has(profile.name)) {
      graph.set(profile.name, []);
    }

    if (!profile.commands || !Array.isArray(profile.commands)) continue;

    for (const command of profile.commands) {
      if (!command.execute || !Array.isArray(command.execute)) continue;

      for (const instruction of command.execute) {
        for (const ref of extractProfileReferences(instruction)) {
          graph.get(profile.name).push(ref);
          edgeLocations.set(
            `${profile.name}->${ref}`,
            findCommandLine(ctx.source, profile.name, command.name)
          );
        }
      }
    }
  }

  // Detect cycles using DFS
  const visited = new Set();
  const inStack = new Set();
  const reported = new Set();

  for (const profileName of graph.keys()) {
    detectCycle(profileName, graph, visited, inStack, reported, edgeLocations, filePath, issues);
  }

  return issues;
}

function detectCycle(node, graph, visited, inStack, reported, edgeLocations, filePath, issues) {
  if (inStack.has(node)) {
    if (!reported.has(node)) {
      reported.add(node);
      issues.push({
        rule: "circular-profile",
        severity: "error",
        message: `Circular profile reference detected involving '${node}'`,
        file: filePath,
        line: edgeLocations.get([...edgeLocations.keys()].find(k => k.endsWith(`->${node}`))) || null
      });
    }
    return;
  }

  if (visited.has(node)) return;

  visited.add(node);
  inStack.add(node);

  const neighbors = graph.get(node) || [];
  for (const neighbor of neighbors) {
    detectCycle(neighbor, graph, visited, inStack, reported, edgeLocations, filePath, issues);
  }

  inStack.delete(node);
}
