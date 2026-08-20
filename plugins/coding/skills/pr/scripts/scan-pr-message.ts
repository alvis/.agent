#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TEMPLATE = resolve(SCRIPT_DIRECTORY, "../templates/message.md");
const SIZE_POLICY = resolve(SCRIPT_DIRECTORY, "../assets/size-thresholds.json");
const STRICT_UTF8 = new TextDecoder("utf-8", { fatal: true });
export const ARCHETYPES = [
  "rfc",
  "code-spec",
  "contract",
  "domain-model",
  "implementation",
  "integration",
  "feature-flag",
  "migration",
  "ui",
  "mechanical-refactor",
  "cleanup",
  "observability",
] as const;
const ZONES = ["green", "yellow", "red", "black"] as const;
const COMMENT = /<!--.*?-->/gs;
const PLACEHOLDER = /\{\{[^{}]+\}\}/g;
const FULL_OID = /^[0-9a-f]{40}$/;
const HEADING = /^ {0,3}(## .+?)\s*$/;
const CHECKBOX = /^\s*[-*]\s+\[[ xX]\]\s+\S/m;
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;
const KEYCAP_EMOJI = /^[#*0-9]\ufe0f?\u20e3$/;
const REVIEWER_ASSIGNED =
  /^\s*[-*]\s+\[([ xX])\]\s+Reviewer (slot [1-9]\d*|@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?) assigned\s*$/gm;
const REVIEWER_EVIDENCE =
  /^\s*[-*]\s+\[([ xX])\]\s+Reviewer (slot [1-9]\d*|@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?) (reviewed|approved) `([0-9a-f]{40})` against `([0-9a-f]{40})`\s*$/gm;
const CODE_SPAN = /`([^`]+)`/g;
const GENERIC = new Set([
  "n/a",
  "na",
  "none",
  "not applicable",
  "placeholder",
  "tbd",
  "todo",
]);
const PROCESS_CLAUSE_SEPARATOR = /\s*(?:[,;]|\b(?:and|or|then)\b)\s*/i;
const PROCESS_QUALIFIER_WORD = String.raw`(?!(?:and|or)\b)[a-z0-9-]+`;
const PROCESS_QUALIFIERS = String.raw`(?:(?:${PROCESS_QUALIFIER_WORD}\s+and\s+)*${PROCESS_QUALIFIER_WORD}(?:\s+${PROCESS_QUALIFIER_WORD}){0,3}\s+)?`;
const PROCESS_SUBJECT = String.raw`(?:all|the|every|a|an)?\s*${PROCESS_QUALIFIERS}(?:tests?|suites?|checks?|builds?|pytest|compilation|pipelines?|ci|lints?|linting|type\s+check(?:s|ing)?|standards?|compliance)`;
const PROCESS_OUTCOME = String.raw`(?:pass(?:es|ed|ing)?|succeed(?:s|ed|ing)?|success(?:ful|fully)?|green|run(?:s|ning)?|execut(?:e|es|ed|ing)|follow(?:s|ed|ing)?|compl(?:y|ies|ied|ying)|compliant|clean)`;
const PROCESS_GATE = new RegExp(
  String.raw`^(?:(?:(?:keep|ensure|require)\s+)?${PROCESS_SUBJECT}\s+(?:(?:is|are|be|must|should|shall)\s+)*${PROCESS_OUTCOME}|(?:follow(?:s|ed|ing)?|run(?:s|ning)?|execut(?:e|es|ed|ing)|compl(?:y|ies|ied|ying)(?:\s+with)?)\s+${PROCESS_SUBJECT}|${PROCESS_SUBJECT}\s+(?:(?:must|should|shall)\s+)?(?:is|are|be|stays?|remains?)\s+${PROCESS_OUTCOME}|(?:no\s+)?${PROCESS_SUBJECT}\s+(?:do(?:es)?\s+not\s+|never\s+)?fail(?:s|ed|ing)?|there\s+(?:is|are)\s+no\s+${PROCESS_QUALIFIERS}(?:test\s+)?failures?)$`,
  "i",
);
const PROCESS_SUBJECT_FRAGMENT = new RegExp(`^${PROCESS_SUBJECT}$`, "i");

export const EMOJI_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00a9, 0x00a9],
  [0x00ae, 0x00ae],
  [0x203c, 0x203c],
  [0x2049, 0x2049],
  [0x2122, 0x2122],
  [0x2139, 0x2139],
  [0x2194, 0x2199],
  [0x21a9, 0x21aa],
  [0x231a, 0x231b],
  [0x2328, 0x2328],
  [0x23cf, 0x23cf],
  [0x23e9, 0x23f3],
  [0x23f8, 0x23fa],
  [0x24c2, 0x24c2],
  [0x25aa, 0x25ab],
  [0x25b6, 0x25b6],
  [0x25c0, 0x25c0],
  [0x25fb, 0x25fe],
  [0x2600, 0x2604],
  [0x260e, 0x260e],
  [0x2611, 0x2611],
  [0x2614, 0x2615],
  [0x2618, 0x2618],
  [0x261d, 0x261d],
  [0x2620, 0x2620],
  [0x2622, 0x2623],
  [0x2626, 0x2626],
  [0x262a, 0x262a],
  [0x262e, 0x262f],
  [0x2638, 0x263a],
  [0x2640, 0x2640],
  [0x2642, 0x2642],
  [0x2648, 0x2653],
  [0x265f, 0x2660],
  [0x2663, 0x2663],
  [0x2665, 0x2666],
  [0x2668, 0x2668],
  [0x267b, 0x267b],
  [0x267e, 0x267f],
  [0x2692, 0x2697],
  [0x2699, 0x2699],
  [0x269b, 0x269c],
  [0x26a0, 0x26a1],
  [0x26a7, 0x26a7],
  [0x26aa, 0x26ab],
  [0x26b0, 0x26b1],
  [0x26bd, 0x26be],
  [0x26c4, 0x26c5],
  [0x26c8, 0x26c8],
  [0x26ce, 0x26cf],
  [0x26d1, 0x26d1],
  [0x26d3, 0x26d4],
  [0x26e9, 0x26ea],
  [0x26f0, 0x26f5],
  [0x26f7, 0x26fa],
  [0x26fd, 0x26fd],
  [0x2702, 0x2702],
  [0x2705, 0x2705],
  [0x2708, 0x270d],
  [0x270f, 0x270f],
  [0x2712, 0x2712],
  [0x2714, 0x2714],
  [0x2716, 0x2716],
  [0x271d, 0x271d],
  [0x2721, 0x2721],
  [0x2728, 0x2728],
  [0x2733, 0x2734],
  [0x2744, 0x2744],
  [0x2747, 0x2747],
  [0x274c, 0x274c],
  [0x274e, 0x274e],
  [0x2753, 0x2755],
  [0x2757, 0x2757],
  [0x2763, 0x2764],
  [0x2795, 0x2797],
  [0x27a1, 0x27a1],
  [0x27b0, 0x27b0],
  [0x27bf, 0x27bf],
  [0x2934, 0x2935],
  [0x2b05, 0x2b07],
  [0x2b1b, 0x2b1c],
  [0x2b50, 0x2b50],
  [0x2b55, 0x2b55],
  [0x3030, 0x3030],
  [0x303d, 0x303d],
  [0x3297, 0x3297],
  [0x3299, 0x3299],
  [0x1f004, 0x1f004],
  [0x1f0cf, 0x1f0cf],
  [0x1f170, 0x1f171],
  [0x1f17e, 0x1f17f],
  [0x1f18e, 0x1f18e],
  [0x1f191, 0x1f19a],
  [0x1f1e6, 0x1f1ff],
  [0x1f201, 0x1f202],
  [0x1f21a, 0x1f21a],
  [0x1f22f, 0x1f22f],
  [0x1f232, 0x1f23a],
  [0x1f250, 0x1f251],
  [0x1f300, 0x1f321],
  [0x1f324, 0x1f393],
  [0x1f396, 0x1f397],
  [0x1f399, 0x1f39b],
  [0x1f39e, 0x1f3f0],
  [0x1f3f3, 0x1f3f5],
  [0x1f3f7, 0x1f4fd],
  [0x1f4ff, 0x1f53d],
  [0x1f549, 0x1f54e],
  [0x1f550, 0x1f567],
  [0x1f56f, 0x1f570],
  [0x1f573, 0x1f57a],
  [0x1f587, 0x1f587],
  [0x1f58a, 0x1f58d],
  [0x1f590, 0x1f590],
  [0x1f595, 0x1f596],
  [0x1f5a4, 0x1f5a5],
  [0x1f5a8, 0x1f5a8],
  [0x1f5b1, 0x1f5b2],
  [0x1f5bc, 0x1f5bc],
  [0x1f5c2, 0x1f5c4],
  [0x1f5d1, 0x1f5d3],
  [0x1f5dc, 0x1f5de],
  [0x1f5e1, 0x1f5e1],
  [0x1f5e3, 0x1f5e3],
  [0x1f5e8, 0x1f5e8],
  [0x1f5ef, 0x1f5ef],
  [0x1f5f3, 0x1f5f3],
  [0x1f5fa, 0x1f64f],
  [0x1f680, 0x1f6c5],
  [0x1f6cb, 0x1f6d2],
  [0x1f6d5, 0x1f6d7],
  [0x1f6dc, 0x1f6e5],
  [0x1f6e9, 0x1f6e9],
  [0x1f6eb, 0x1f6ec],
  [0x1f6f0, 0x1f6f0],
  [0x1f6f3, 0x1f6fc],
  [0x1f7e0, 0x1f7eb],
  [0x1f7f0, 0x1f7f0],
  [0x1f90c, 0x1f93a],
  [0x1f93c, 0x1f945],
  [0x1f947, 0x1f9ff],
  [0x1fa70, 0x1fa7c],
  [0x1fa80, 0x1fa88],
  [0x1fa90, 0x1fabd],
  [0x1fabf, 0x1fac5],
  [0x1face, 0x1fadb],
  [0x1fae0, 0x1fae8],
  [0x1faf0, 0x1faf8],
];

export interface Violation {
  rule_id: string;
  message: string;
}
interface ParsedMessage {
  preamble: string;
  headings: string[];
  sections: Map<string, string>;
}
interface ScanOptions {
  body: string;
  template: string;
  zone: string;
  archetype: string;
  generatedFiles: string[];
  forbidComments: boolean;
  headOid: string;
  baseOid: string;
  allowPendingReviewers: boolean;
}

function splitLines(value: string): string[] {
  if (!value) return [];
  const lines = value.split(/\r\n|\r|\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function readUtf8(source: string | number): string {
  const bytes = readFileSync(source);
  for (let index = 0; index < bytes.length;) {
    const first = bytes[index]!;
    if (first < 0x80) {
      index += 1;
      continue;
    }
    const length =
      first >= 0xc2 && first <= 0xdf
        ? 2
        : first >= 0xe0 && first <= 0xef
          ? 3
          : first >= 0xf0 && first <= 0xf4
            ? 4
            : 0;
    if (length === 0)
      throw new TypeError(
        `'utf-8' codec can't decode byte 0x${first.toString(16)} in position ${index}: invalid start byte`,
      );
    if (index + length > bytes.length)
      throw new TypeError(
        `'utf-8' codec can't decode byte 0x${first.toString(16)} in position ${index}: unexpected end of data`,
      );
    const second = bytes[index + 1]!;
    const validBoundary =
      length !== 3 ||
      ((first !== 0xe0 || second >= 0xa0) &&
        (first !== 0xed || second <= 0x9f));
    const validFourByteBoundary =
      length !== 4 ||
      ((first !== 0xf0 || second >= 0x90) &&
        (first !== 0xf4 || second <= 0x8f));
    const invalidContinuation = [
      ...bytes.subarray(index + 1, index + length),
    ].findIndex((byte) => byte < 0x80 || byte > 0xbf);
    if (!validBoundary || !validFourByteBoundary || invalidContinuation >= 0)
      throw new TypeError(
        `'utf-8' codec can't decode byte 0x${first.toString(16)} in position ${index}: invalid continuation byte`,
      );
    index += length;
  }
  return STRICT_UTF8.decode(bytes);
}

export function parseMessage(value: string): ParsedMessage {
  const lines = splitLines(value.replace(COMMENT, ""));
  const preamble: string[] = [];
  const headings: string[] = [];
  const sectionLines = new Map<string, string[]>();
  let current: string | undefined;
  let fence: string | undefined;
  for (const line of lines) {
    const stripped = line.trimStart();
    const marker = stripped.slice(0, 3);
    if (fence) {
      if (stripped.startsWith(fence)) fence = undefined;
      (current ? sectionLines.get(current)! : preamble).push(line);
      continue;
    }
    if (marker === "```" || marker === "~~~") fence = marker;
    const heading = fence ? null : line.match(HEADING);
    if (heading) {
      current = heading[1]!;
      headings.push(current);
      if (!sectionLines.has(current)) sectionLines.set(current, []);
      continue;
    }
    (current ? sectionLines.get(current)! : preamble).push(line);
  }
  return {
    preamble: preamble.join("\n").trim(),
    headings,
    sections: new Map(
      [...sectionLines].map(([heading, content]) => [
        heading,
        content.join("\n").trim(),
      ]),
    ),
  };
}

function normalizedEvidence(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`*_>#\[\]()-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
    .replace(/^[.,:;!?]+|[.,:;!?]+$/g, "");
}

function proseWithoutCode(value: string): string {
  const prose: string[] = [];
  let fence: string | undefined;
  for (const line of splitLines(value)) {
    const marker = line.trimStart().slice(0, 3);
    if (fence) {
      if (line.trimStart().startsWith(fence)) fence = undefined;
      continue;
    }
    if (marker === "```" || marker === "~~~") {
      fence = marker;
      continue;
    }
    prose.push(line.replace(CODE_SPAN, ""));
  }
  return prose.join("\n");
}

function cartesian(values: string[][]): string[][] {
  return values.reduce<string[][]>(
    (rows, options) =>
      rows.flatMap((row) => options.map((option) => [...row, option])),
    [[]],
  );
}

function placeholderOnlyEvidence(value: string): boolean {
  let sawPlaceholder = false;
  for (const line of splitLines(proseWithoutCode(value))) {
    const placeholders = [...line.matchAll(/\{\{[^{}]+\}\}/g)].map(
      (match) => match[0],
    );
    if (!placeholders.length) {
      if (normalizedEvidence(line)) return false;
      continue;
    }
    sawPlaceholder = true;
    const residue = normalizedEvidence(line.replace(/\{\{[^{}]+\}\}/g, ""))
      .replace(/[^\p{L}\p{N}_\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
      .join(" ");
    if (!residue) continue;
    const options = placeholders.map((placeholder) => {
      const normalized = placeholder
        .slice(2, -2)
        .replace(/[_-]/g, " ")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .join(" ");
      return [
        ...new Set([
          normalized,
          normalized.replace(/\s+(body|content|details|text|value)$/, ""),
        ]),
      ];
    });
    if (
      !new Set(cartesian(options).map((parts) => parts.join(" "))).has(residue)
    )
      return false;
  }
  return sawPlaceholder;
}

function isMissingOrGeneric(value: string): boolean {
  if (placeholderOnlyEvidence(value)) return true;
  const normalized = normalizedEvidence(value);
  return !normalized || GENERIC.has(normalized);
}

export function requirementsAreProcessOnly(value: string): boolean {
  const requirements = splitLines(
    proseWithoutCode(value.replace(PLACEHOLDER, "")),
  )
    .map((line) => normalizedEvidence(line.replace(LIST_MARKER, "")))
    .filter(Boolean);
  const clauses = requirements.flatMap((requirement) =>
    PROCESS_GATE.test(requirement)
      ? [requirement]
      : requirement
          .split(PROCESS_CLAUSE_SEPARATOR)
          .map(normalizedEvidence)
          .filter(Boolean),
  );
  const processClauses = clauses.map((clause) => PROCESS_GATE.test(clause));
  return (
    clauses.length > 0 &&
    processClauses.some(Boolean) &&
    clauses.every(
      (clause, index) =>
        processClauses[index] || PROCESS_SUBJECT_FRAGMENT.test(clause),
    )
  );
}

export function isEmojiPrefix(prefix: string): boolean {
  if (KEYCAP_EMOJI.test(prefix)) return true;
  const codepoint = prefix.codePointAt(0);
  return (
    codepoint !== undefined &&
    EMOJI_RANGES.some(([start, end]) => start <= codepoint && codepoint <= end)
  );
}

function headingName(heading: string): string {
  const label = heading.replace(/^## /, "").replace(/ \[ Optional \]$/, "");
  const space = label.indexOf(" ");
  const prefix = space < 0 ? label : label.slice(0, space);
  return semanticHeadingCasefold(
    isEmojiPrefix(prefix) && space >= 0 ? label.slice(space + 1) : label,
  );
}

const ASCII_CASEFOLD_EXPANSIONS: Readonly<Record<string, string>> = {
  ß: "ss",
  ſ: "s",
  ﬀ: "ff",
  ﬁ: "fi",
  ﬂ: "fl",
  ﬃ: "ffi",
  ﬄ: "ffl",
  ﬅ: "st",
  ﬆ: "st",
};

function semanticHeadingCasefold(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ßſﬀ-ﬆ]/gu, (character) => ASCII_CASEFOLD_EXPANSIONS[character]!);
}

function headingFor(
  parsed: ParsedMessage,
  name: string,
  fallback = `## ${name}`,
): string {
  return (
    parsed.headings.find(
      (heading) => headingName(heading) === semanticHeadingCasefold(name),
    ) ?? fallback
  );
}

function addHeadingContractViolations(
  violations: Violation[],
  template: ParsedMessage,
): void {
  for (const heading of template.headings) {
    const prefix = heading.replace(/^## /, "").split(/\s+/, 1)[0];
    if (!prefix || !isEmojiPrefix(prefix))
      violations.push({
        rule_id: "GIT-PR-02",
        message: `section lacks an emoji prefix: ${heading}`,
      });
  }
}

function wildcardPattern(pattern: string): RegExp {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]!;
    if (character === "*") {
      if (!source.endsWith(".*")) source += ".*";
    } else if (character === "?") source += ".";
    else if (character === "[") {
      let end = index + 1;
      if (pattern[end] === "!") end += 1;
      if (pattern[end] === "]") end += 1;
      while (end < pattern.length && pattern[end] !== "]") end += 1;
      if (end >= pattern.length) source += "\\[";
      else {
        const start = index + 1;
        let stuff = pattern.slice(start, end);
        if (stuff.includes("-")) {
          const chunks: string[] = [];
          let chunkStart = start;
          let hyphen = pattern.indexOf(
            "-",
            pattern[start] === "!" ? start + 2 : start + 1,
          );
          while (hyphen >= 0 && hyphen < end) {
            chunks.push(pattern.slice(chunkStart, hyphen));
            chunkStart = hyphen + 1;
            hyphen = pattern.indexOf("-", hyphen + 3);
          }
          const finalChunk = pattern.slice(chunkStart, end);
          if (finalChunk) chunks.push(finalChunk);
          else chunks[chunks.length - 1] += "-";
          for (let chunk = chunks.length - 1; chunk > 0; chunk -= 1) {
            const previous = chunks[chunk - 1]!;
            const current = chunks[chunk]!;
            const previousCharacters = [...previous];
            const currentCharacters = [...current];
            if (
              previousCharacters.at(-1)!.codePointAt(0)! >
              currentCharacters[0]!.codePointAt(0)!
            ) {
              chunks[chunk - 1] =
                previousCharacters.slice(0, -1).join("") +
                currentCharacters.slice(1).join("");
              chunks.splice(chunk, 1);
            }
          }
          stuff = chunks
            .map((chunk) => chunk.replace(/\\/g, "\\\\").replace(/-/g, "\\-"))
            .join("-");
        } else stuff = stuff.replace(/\\/g, "\\\\");
        stuff = stuff.replace(/([&~|])/g, "\\$1");
        index = end;
        if (!stuff) source += "(?!)";
        else if (stuff === "!") source += ".";
        else {
          if (stuff.startsWith("!")) stuff = `^${stuff.slice(1)}`;
          else if (stuff.startsWith("^") || stuff.startsWith("["))
            stuff = `\\${stuff}`;
          stuff = stuff.replace(/\]/g, "\\]");
          source += `[${stuff}]`;
        }
      }
    } else source += character.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  }
  return new RegExp(`^${source}$`, "su");
}

function generatedPathIsNamed(path: string, evidence: string): boolean {
  if (evidence.includes(path)) return true;
  const tokens = [...evidence.matchAll(/`([^`]+)`/g)]
    .map((match) => match[1]!)
    .concat(evidence.split(/\s+/));
  return [
    ...new Set(
      tokens
        .filter((token) => /[*?[]/.test(token))
        .map((token) =>
          token.replace(/^[`'"(){}<>.,:;]+|[`'"(){}<>.,:;]+$/g, ""),
        ),
    ),
  ].some((pattern) => wildcardPattern(pattern).test(path));
}

function requiredReviewerCount(zone: string): number {
  const zones = (
    JSON.parse(readUtf8(SIZE_POLICY)) as {
      zones: Array<{ name: string; required_reviewers: number }>;
    }
  ).zones;
  return (
    zones.find((item) => item.name === zone)?.required_reviewers ??
    zones.at(-1)!.required_reviewers
  );
}

function reviewerTripletCount(
  verification: string,
  headOid: string,
  baseOid: string,
  allowPending: boolean,
): number {
  const assigned = new Set<string>();
  for (const match of verification.matchAll(REVIEWER_ASSIGNED))
    if (allowPending || match[1]!.toLowerCase() === "x")
      assigned.add(match[2]!);
  const evidence = new Map<string, Map<string, string>>();
  for (const match of verification.matchAll(REVIEWER_EVIDENCE)) {
    if (
      (!allowPending && match[1]!.toLowerCase() !== "x") ||
      match[4] !== headOid ||
      match[5] !== baseOid
    )
      continue;
    if (!evidence.has(match[2]!)) evidence.set(match[2]!, new Map());
    evidence.get(match[2]!)!.set(match[3]!, `${match[4]}:${match[5]}`);
  }
  return [...evidence].filter(
    ([reviewer, tasks]) =>
      assigned.has(reviewer) &&
      tasks.has("reviewed") &&
      tasks.get("reviewed") === tasks.get("approved"),
  ).length;
}

function addRequiredSection(
  violations: Violation[],
  parsed: ParsedMessage,
  heading: string,
  ruleId: string,
): void {
  if (!parsed.sections.has(heading))
    violations.push({
      rule_id: ruleId,
      message: `missing required section: ${heading}`,
    });
  else if (isMissingOrGeneric(parsed.sections.get(heading)!))
    violations.push({
      rule_id: ruleId,
      message: `missing specific evidence: ${heading}`,
    });
}

export function scan(options: ScanOptions): Violation[] {
  const {
    body,
    template,
    zone,
    archetype,
    generatedFiles,
    forbidComments,
    headOid,
    baseOid,
    allowPendingReviewers,
  } = options;
  const violations: Violation[] = [];
  const parsed = parseMessage(body);
  const parsedTemplate = parseMessage(template);
  const bundledTemplate = parseMessage(readUtf8(DEFAULT_TEMPLATE));
  const rendered = (heading: string) =>
    forbidComments ? heading.replace(/ \[ Optional \]$/, "") : heading;
  const selected = (name: string) =>
    rendered(
      headingFor(parsedTemplate, name, headingFor(bundledTemplate, name)),
    );
  const allowed = parsedTemplate.headings.map(rendered);
  const required = parsedTemplate.headings
    .filter((heading) => !heading.endsWith(" [ Optional ]"))
    .map(rendered);
  for (const bundled of bundledTemplate.headings.filter(
    (heading) => !heading.endsWith(" [ Optional ]"),
  )) {
    const heading = rendered(
      headingFor(parsedTemplate, headingName(bundled), bundled),
    );
    if (!required.includes(heading)) required.push(heading);
  }
  addHeadingContractViolations(violations, parsedTemplate);
  const bodyComments = [...body.matchAll(COMMENT)].map((match) => match[0]);
  const templateComments = [...template.matchAll(COMMENT)].map(
    (match) => match[0],
  );
  if (forbidComments && bodyComments.length)
    violations.push({
      rule_id: "GIT-PR-02",
      message: "rendered body contains template guidance comments",
    });
  if (
    !forbidComments &&
    JSON.stringify(bodyComments) !== JSON.stringify(templateComments)
  )
    violations.push({
      rule_id: "GIT-PR-02",
      message:
        "rendered body does not preserve repository template comments verbatim",
    });
  if (forbidComments && /\{\{[^{}]+\}\}/.test(proseWithoutCode(body)))
    violations.push({
      rule_id: "GIT-PR-02",
      message: "rendered body contains unresolved placeholders",
    });
  const templateLiterals = splitLines(parsedTemplate.preamble)
    .map((line) => line.trim())
    .filter((line) => line && !/\{\{[^{}]+\}\}/.test(line));
  const bodyLines = splitLines(parsed.preamble)
    .map((line) => line.trim())
    .filter(Boolean);
  if (
    templateLiterals.length &&
    JSON.stringify(bodyLines.slice(0, templateLiterals.length)) !==
      JSON.stringify(templateLiterals)
  )
    violations.push({
      rule_id: "GIT-PR-02",
      message: "rendered body does not preserve the template preamble",
    });
  const summaryTemplateHeading = parsedTemplate.headings.find(
    (heading) => headingName(heading) === "summary",
  );
  const preambleSummary = bodyLines
    .filter((line) => !templateLiterals.includes(line))
    .join("\n");
  const sectionSummary = summaryTemplateHeading
    ? (parsed.sections.get(rendered(summaryTemplateHeading)) ?? "")
    : "";
  if (
    isMissingOrGeneric(
      isMissingOrGeneric(sectionSummary) ? preambleSummary : sectionSummary,
    )
  )
    violations.push({
      rule_id: "GIT-PR-02",
      message: "rendered body has no summary",
    });
  for (const heading of required)
    addRequiredSection(violations, parsed, heading, "GIT-PR-02");
  const requirements = parsed.sections.get(selected("Requirements")) ?? "";
  if (requirements && requirementsAreProcessOnly(requirements))
    violations.push({
      rule_id: "GIT-PR-02",
      message:
        "Requirements contains only generic process gates, not observable behavior",
    });
  for (const heading of parsed.headings.filter(
    (heading) => !allowed.includes(heading),
  ))
    violations.push({
      rule_id: "GIT-PR-02",
      message: `section is not owned by the selected template: ${heading}`,
    });
  for (const heading of [
    ...new Set(
      parsed.headings.filter(
        (candidate) =>
          parsed.headings.filter((item) => item === candidate).length > 1,
      ),
    ),
  ].sort())
    violations.push({
      rule_id: "GIT-PR-02",
      message: `duplicate template section: ${heading}`,
    });
  const positions = parsed.headings
    .filter((heading) => allowed.includes(heading))
    .map((heading) => allowed.indexOf(heading));
  if (
    positions.some(
      (position, index) => index > 0 && position < positions[index - 1]!,
    )
  )
    violations.push({
      rule_id: "GIT-PR-02",
      message: "template sections are out of order",
    });
  if (forbidComments)
    for (const [heading, content] of parsed.sections)
      if (allowed.includes(heading) && isMissingOrGeneric(content))
        violations.push({
          rule_id: "GIT-PR-02",
          message: `included section has no specific content: ${heading}`,
        });
  const verification = parsed.sections.get(selected("Verification")) ?? "";
  if (verification && !CHECKBOX.test(verification))
    violations.push({
      rule_id: "GIT-PR-02",
      message: "Verification contains no checklist item",
    });
  const reviewerCount = requiredReviewerCount(zone);
  if (
    reviewerTripletCount(
      verification,
      headOid,
      baseOid,
      allowPendingReviewers,
    ) < reviewerCount
  )
    violations.push({
      rule_id: zone === "yellow" ? "GIT-PR-SIZE-02" : "GIT-PR-SIZE-03",
      message: `Verification requires ${reviewerCount} confirmed reviewer evidence triplet(s) for the ${zone} zone bound to the active revision`,
    });
  const risk = selected("Risk"),
    testPlan = selected("Test Plan"),
    whySize = selected("Why This Size");
  if (zone === "yellow" || zone === "red") {
    addRequiredSection(violations, parsed, risk, "GIT-PR-SIZE-02");
    addRequiredSection(violations, parsed, testPlan, "GIT-PR-SIZE-02");
  }
  if (zone === "red")
    addRequiredSection(violations, parsed, whySize, "GIT-PR-SIZE-03");
  if (zone === "black")
    for (const heading of [risk, testPlan, whySize])
      addRequiredSection(violations, parsed, heading, "GIT-PR-SIZE-04");
  const conditional: Record<string, [string, string]> = {
    migration: ["Rollback", "GIT-PR-TYPE-03"],
    "feature-flag": ["Feature Flag", "GIT-PR-STACK-04"],
    ui: ["Screenshots", "GIT-PR-02"],
  };
  if (conditional[archetype])
    addRequiredSection(
      violations,
      parsed,
      selected(conditional[archetype]![0]),
      conditional[archetype]![1],
    );
  if (generatedFiles.length) {
    const heading = selected("Generated Files");
    addRequiredSection(violations, parsed, heading, "GIT-PR-TYPE-05");
    const evidence = parsed.sections.get(heading) ?? "";
    const unnamed = generatedFiles.filter(
      (path) => !generatedPathIsNamed(path, evidence),
    );
    if (evidence && unnamed.length)
      violations.push({
        rule_id: "GIT-PR-TYPE-05",
        message: `Generated Files does not name or match: ${unnamed.join(", ")}`,
      });
  }
  return [
    ...new Map(
      violations.map((item) => [`${item.rule_id}\0${item.message}`, item]),
    ).entries(),
  ]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([, item]) => item);
}

interface Arguments {
  bodyFile: string;
  template: string;
  zone: string;
  archetype: string;
  headOid: string;
  baseOid: string;
  allowPendingReviewers: boolean;
  generatedFiles: string[];
}
const USAGE =
  "usage: scan-pr-message.ts [-h] --body-file BODY_FILE [--template TEMPLATE]\n                          --zone {green,yellow,red,black}\n                          --archetype {rfc,code-spec,contract,domain-model,implementation,integration,feature-flag,migration,ui,mechanical-refactor,cleanup,observability}\n                          --head-oid HEAD_OID --base-oid BASE_OID\n                          [--allow-pending-reviewers]\n                          [--generated-file GENERATED_FILE]";
const SCANNER_OPTIONS = [
  "--help",
  "--body-file",
  "--template",
  "--zone",
  "--archetype",
  "--head-oid",
  "--base-oid",
  "--allow-pending-reviewers",
  "--generated-file",
];
const ARGPARSE_NEGATIVE_NUMBER = /^-\p{Nd}+$|^-\p{Nd}*\.\p{Nd}+$/u;

function isSeparatedArgumentValue(value: string): boolean {
  return (
    !value.startsWith("-") ||
    value === "-" ||
    ARGPARSE_NEGATIVE_NUMBER.test(value)
  );
}

function resolveScannerOption(rawArgument: string): string | null {
  const name = rawArgument.split("=", 1)[0]!;
  const candidates = SCANNER_OPTIONS.filter((option) =>
    option.startsWith(name),
  );
  if (candidates.includes(name)) return name;
  if (candidates.length > 1) {
    argumentError(
      `ambiguous option: ${rawArgument} could match ${candidates.join(", ")}`,
    );
    return null;
  }
  return candidates[0] ?? rawArgument;
}

function parseArguments(argv: string[]): Arguments | null {
  const values = new Map<string, string>();
  const generatedFiles: string[] = [];
  const unknown: string[] = [];
  let allowPendingReviewers = false;
  for (let index = 0; index < argv.length; index += 1) {
    const rawArgument = argv[index]!;
    const equals = rawArgument.indexOf("=");
    if (rawArgument === "-h" || rawArgument.startsWith("-h=")) {
      if (rawArgument !== "-h")
        return argumentError(
          `argument -h/--help: ignored explicit argument '${rawArgument.slice(3)}'`,
        );
      process.stdout.write(
        `${USAGE}\n\nScan a rendered PR message for template conformance.\n\noptions:\n  -h, --help            show this help message and exit\n  --body-file BODY_FILE\n                        Rendered PR body path, or - for stdin.\n  --template TEMPLATE   Selected PR template; defaults to the bundled\n                        message.md.\n  --zone {green,yellow,red,black}\n  --archetype {${ARCHETYPES.join(",")}}\n  --head-oid HEAD_OID\n  --base-oid BASE_OID\n  --allow-pending-reviewers\n                        Allow unchecked reviewer triplets during authoring\n                        only.\n  --generated-file GENERATED_FILE\n                        Changed generated path; repeat for every generated\n                        path.\n`,
      );
      return null;
    }
    const argument = rawArgument.startsWith("--")
      ? resolveScannerOption(rawArgument)
      : rawArgument;
    if (argument === null) return null;
    if (argument === "--help") {
      if (equals >= 0)
        return argumentError(
          `argument -h/--help: ignored explicit argument '${rawArgument.slice(equals + 1)}'`,
        );
      process.stdout.write(
        `${USAGE}\n\nScan a rendered PR message for template conformance.\n\noptions:\n  -h, --help            show this help message and exit\n  --body-file BODY_FILE\n                        Rendered PR body path, or - for stdin.\n  --template TEMPLATE   Selected PR template; defaults to the bundled\n                        message.md.\n  --zone {green,yellow,red,black}\n  --archetype {${ARCHETYPES.join(",")}}\n  --head-oid HEAD_OID\n  --base-oid BASE_OID\n  --allow-pending-reviewers\n                        Allow unchecked reviewer triplets during authoring\n                        only.\n  --generated-file GENERATED_FILE\n                        Changed generated path; repeat for every generated\n                        path.\n`,
      );
      return null;
    }
    if (argument === "--allow-pending-reviewers") {
      if (equals >= 0)
        return argumentError(
          `argument --allow-pending-reviewers: ignored explicit argument '${rawArgument.slice(equals + 1)}'`,
        );
      allowPendingReviewers = true;
      continue;
    }
    if (
      [
        "--body-file",
        "--template",
        "--zone",
        "--archetype",
        "--head-oid",
        "--base-oid",
        "--generated-file",
      ].includes(argument)
    ) {
      const inlineValue =
        equals < 0 ? undefined : rawArgument.slice(equals + 1);
      const value = inlineValue ?? argv[index + 1];
      if (
        value === undefined ||
        (inlineValue === undefined && !isSeparatedArgumentValue(value))
      )
        return argumentError(`argument ${argument}: expected one argument`);
      if (
        argument === "--zone" &&
        !ZONES.includes(value as (typeof ZONES)[number])
      )
        return argumentError(
          `argument --zone: invalid choice: '${value}' (choose from 'green', 'yellow', 'red', 'black')`,
        );
      if (
        argument === "--archetype" &&
        !ARCHETYPES.includes(value as (typeof ARCHETYPES)[number])
      )
        return argumentError(
          `argument --archetype: invalid choice: '${value}' (choose from ${ARCHETYPES.map((item) => `'${item}'`).join(", ")})`,
        );
      if (
        (argument === "--head-oid" || argument === "--base-oid") &&
        !FULL_OID.test(value)
      )
        return argumentError(
          `argument ${argument}: must be a lowercase 40-character Git OID`,
        );
      if (argument === "--generated-file") generatedFiles.push(value);
      else values.set(argument, value);
      if (inlineValue === undefined) index += 1;
    } else unknown.push(rawArgument);
  }
  const required = [
    "--body-file",
    "--zone",
    "--archetype",
    "--head-oid",
    "--base-oid",
  ];
  const missing = required.filter((name) => !values.has(name));
  if (missing.length)
    return argumentError(
      `the following arguments are required: ${missing.join(", ")}`,
    );
  if (unknown.length)
    return argumentError(`unrecognized arguments: ${unknown.join(" ")}`);
  return {
    bodyFile: values.get("--body-file")!,
    template: values.get("--template") ?? DEFAULT_TEMPLATE,
    zone: values.get("--zone")!,
    archetype: values.get("--archetype")!,
    headOid: values.get("--head-oid")!,
    baseOid: values.get("--base-oid")!,
    allowPendingReviewers,
    generatedFiles,
  };
}

function argumentError(message: string): null {
  process.stderr.write(`${USAGE}\nscan-pr-message.ts: error: ${message}\n`);
  process.exitCode = 2;
  return null;
}

function pythonJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(pythonJson).join(", ")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => `${pythonString(key)}: ${pythonJson(item)}`)
      .join(", ")}}`;
  return typeof value === "string"
    ? pythonString(value)
    : JSON.stringify(value);
}

function pythonString(value: string): string {
  return JSON.stringify(value).replace(
    /[^\x00-\x7f]/g,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

export function main(argv = process.argv.slice(2)): number {
  const args = parseArguments(argv);
  if (!args) return process.exitCode ?? 0;
  const body = readUtf8(args.bodyFile === "-" ? 0 : args.bodyFile);
  const template = readUtf8(args.template);
  const violations = scan({
    body,
    template,
    zone: args.zone,
    archetype: args.archetype,
    generatedFiles: args.generatedFiles,
    forbidComments: resolve(args.template) === resolve(DEFAULT_TEMPLATE),
    headOid: args.headOid,
    baseOid: args.baseOid,
    allowPendingReviewers: args.allowPendingReviewers,
  });
  process.stdout.write(
    `${pythonJson({ template: resolve(args.template), valid: violations.length === 0, violations })}\n`,
  );
  return violations.length ? 1 : 0;
}

if (import.meta.main) process.exitCode = main();
