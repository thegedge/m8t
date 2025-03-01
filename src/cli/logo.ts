import chalk from "chalk";
import type { WriteStream } from "node:tty";

export const printLogo = (stream: WriteStream) => {
  if (!stream.isTTY) {
    return;
  }

  if (stream.columns > LOGO_WIDTH) {
    stream.write(LOGO_LINES.join("\n"));
  } else if (stream.columns > LOGO_SMALL_WIDTH) {
    stream.write(LOGO_SMALL_LINES.join("\n"));
  }
};

const LOGO_LINE_GAP = "  ";

export const printLogoAndTitleWithLines = (stream: WriteStream, lines: string[]) => {
  printLogoWithLines(stream, [...M8T_TITLE_LINES, "", ...lines]);
};

export const printLogoWithLines = (stream: WriteStream, lines: string[]) => {
  if (!stream.isTTY) {
    stream.write(lines.join("\n"));
    return;
  }

  let logo: string[];
  let logoWidth: number;
  const maxLineLength = lines.reduce((max, line) => Math.max(max, stripAnsi(line).length), 0);
  if (stream.columns > LOGO_WIDTH + LOGO_LINE_GAP.length + maxLineLength) {
    logo = LOGO_LINES;
    logoWidth = LOGO_WIDTH;
  } else if (stream.columns > LOGO_SMALL_WIDTH + LOGO_LINE_GAP.length + maxLineLength) {
    logo = LOGO_SMALL_LINES;
    logoWidth = LOGO_SMALL_WIDTH;
  } else {
    stream.write(lines.join("\n"));
    return;
  }

  const numLines = Math.max(logo.length, lines.length);
  for (let i = 0; i < numLines; i++) {
    if (i < logo.length) {
      stream.write(logo[i]);
    }

    if (i < lines.length) {
      if (i < logo.length) {
        stream.write(LOGO_LINE_GAP);
      } else {
        stream.write(" ".repeat(logoWidth) + LOGO_LINE_GAP);
      }

      stream.write(lines[i]);
    }

    stream.write("\n");
  }
};

const stripAnsi = (str: string) => str.replaceAll(/[\e\u001B]\[(?:(8;;.+?\u0007)|(.*?m))/g, "");

const C = chalk.bgHex("#F98C00")(" ");
const S = " ";

const M8T_TITLE_LINES = [
  [S, S, S, S, S, S, S, S, S, C, C, S, S, S, S, S].join(""),
  [C, S, S, S, S, S, S, S, C, S, S, C, S, S, C, S].join(""),
  [C, C, C, S, C, C, S, S, S, C, C, S, S, C, C, C].join(""),
  [C, S, S, C, S, S, C, S, C, S, S, C, S, S, C, S].join(""),
  [C, S, S, C, S, S, C, S, S, C, C, S, S, S, C, S].join(""),
];

const HI_BOX_CHAR = "\u2580";
const LO_BOX_CHAR = "\u2584";
const ALL_WHITE = chalk.bgRgb(255, 255, 255)(" ");
const ALL_ORANGE = chalk.bgRgb(255, 150, 0)(" ");

const LOGO: string[][] = [
  [
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    chalk.rgb(140, 50, 40)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(245, 150, 45).bgRgb(100, 30, 45)(LO_BOX_CHAR),
    chalk.rgb(250, 230, 210).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(250, 160, 150).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(245, 150, 60).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(70, 20, 50)(LO_BOX_CHAR),
    " ",
    " ",
    " ",
  ],
  [
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    chalk.rgb(70, 20, 50)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 0).bgRgb(70, 20, 50)(LO_BOX_CHAR),
    ALL_ORANGE,
    chalk.rgb(250, 230, 210).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(70, 20, 50).bgRgb(250, 230, 210)(LO_BOX_CHAR),
    chalk.rgb(205, 45, 60).bgRgb(70, 20, 50)(LO_BOX_CHAR),
    chalk.rgb(250, 150, 140).bgRgb(245, 139, 135)(LO_BOX_CHAR),
    chalk.bgRgb(250, 230, 210)(" "),
    chalk.rgb(245, 175, 110).bgRgb(250, 180, 120)(LO_BOX_CHAR),
    chalk.bgRgb(70, 20, 50)(" "),
    " ",
    " ",
    " ",
  ],
  [
    chalk.rgb(255, 255, 255).bgRgb(255, 250, 240)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 0).bgRgb(245, 150, 50)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 0).bgRgb(145, 70, 60)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 0).bgRgb(70, 20, 50)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(245, 140, 3).bgRgb(105, 35, 45)(LO_BOX_CHAR),
    chalk.rgb(200, 80, 20).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(200, 80, 20).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(250, 140, 2).bgRgb(200, 80, 20)(LO_BOX_CHAR),
    chalk.bgRgb(250, 230, 210)(" "),
    chalk.rgb(185, 40, 60).bgRgb(70, 20, 50)(LO_BOX_CHAR),
    chalk.rgb(250, 150, 140).bgRgb(210, 40, 65)(LO_BOX_CHAR),
    chalk.bgRgb(250, 150, 140)(" "),
    chalk.rgb(250, 230, 210).bgRgb(250, 215, 200)(LO_BOX_CHAR),
    chalk.bgRgb(250, 230, 210)(" "),
    ALL_ORANGE,
    " ",
    " ",
    " ",
    " ",
  ],
  [
    ALL_WHITE,
    ALL_ORANGE,
    ALL_ORANGE,
    ALL_ORANGE,
    ALL_ORANGE,
    ALL_ORANGE,
    chalk.rgb(255, 150, 0).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 0).bgRgb(200, 80, 20)(LO_BOX_CHAR),
    ALL_ORANGE,
    chalk.rgb(210, 40, 65).bgRgb(70, 20, 50)(LO_BOX_CHAR),
    chalk.bgRgb(210, 40, 65)(" "),
    chalk.bgRgb(250, 150, 140)(" "),
    chalk.bgRgb(250, 230, 210)(" "),
    chalk.bgRgb(250, 230, 210)(" "),
    chalk.rgb(255, 150, 0).bgRgb(250, 230, 210)(LO_BOX_CHAR),
    chalk.rgb(135, 45, 45)(HI_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
  ],
  [
    ALL_WHITE,
    ALL_ORANGE,
    chalk.rgb(255, 255, 255).bgRgb(255, 250, 250)(LO_BOX_CHAR),
    ALL_WHITE,
    chalk.rgb(220, 170, 150).bgRgb(255, 250, 250)(LO_BOX_CHAR),
    chalk.rgb(70, 20, 50).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    ALL_ORANGE,
    ALL_ORANGE,
    chalk.rgb(255, 150, 0).bgRgb(210, 90, 15)(LO_BOX_CHAR),
    chalk.rgb(70, 20, 50).bgRgb(210, 40, 65)(LO_BOX_CHAR),
    chalk.rgb(250, 150, 140).bgRgb(215, 65, 80)(LO_BOX_CHAR),
    chalk.rgb(250, 230, 210).bgRgb(250, 150, 140)(LO_BOX_CHAR),
    chalk.rgb(250, 225, 200).bgRgb(250, 230, 210)(LO_BOX_CHAR),
    ALL_ORANGE,
    chalk.rgb(70, 20, 50)(HI_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
    " ",
  ],
  [
    ALL_WHITE,
    ALL_ORANGE,
    chalk.rgb(255, 150, 0).bgRgb(250, 150, 40)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 0).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    chalk.rgb(70, 20, 50).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(160, 65, 30).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    ALL_ORANGE,
    ALL_ORANGE,
    ALL_ORANGE,
    chalk.rgb(200, 80, 20).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 0).bgRgb(150, 65, 60)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 0).bgRgb(165, 80, 80)(LO_BOX_CHAR),
    ALL_ORANGE,
    chalk.rgb(70, 20, 50).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
  ],
  [
    ALL_WHITE,
    chalk.rgb(255, 255, 255).bgRgb(250, 160, 50)(LO_BOX_CHAR),
    chalk.rgb(250, 150, 15).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.bgRgb(70, 20, 50)(" "),
    chalk.rgb(255, 250, 240).bgRgb(70, 20, 50)("●"),
    chalk.bgRgb(70, 20, 50)(" "),
    ALL_ORANGE,
    ALL_ORANGE,
    ALL_ORANGE,
    ALL_ORANGE,
    chalk.rgb(200, 80, 20).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(175, 90, 20).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(70, 20, 50)(HI_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
  ],
  [
    chalk.rgb(70, 20, 50).bgRgb(250, 240, 240)(LO_BOX_CHAR),
    chalk.rgb(70, 20, 50).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    chalk.rgb(70, 20, 50).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    ALL_WHITE,
    chalk.rgb(255, 250, 250).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(240, 165, 105).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(255, 255, 255).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(255, 255, 255).bgRgb(240, 150, 85)(LO_BOX_CHAR),
    ALL_WHITE,
    ALL_WHITE,
    ALL_ORANGE,
    chalk.rgb(70, 20, 50).bgRgb(165, 60, 45)(LO_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
  ],
  [
    chalk.bgRgb(70, 20, 50)(" "),
    chalk.bgRgb(70, 20, 50)(" "),
    chalk.rgb(235, 190, 185).bgRgb(70, 20, 50)(LO_BOX_CHAR),
    ALL_WHITE,
    chalk.rgb(240, 225, 225).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    chalk.rgb(230, 200, 190).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    chalk.rgb(88, 25, 50).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    chalk.rgb(250, 219, 195).bgRgb(230, 130, 30)(LO_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
  ],
  [
    chalk.rgb(120, 50, 60).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    chalk.rgb(135, 90, 100).bgRgb(195, 139, 130)(LO_BOX_CHAR),
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    chalk.rgb(250, 230, 210).bgRgb(250, 235, 220)(LO_BOX_CHAR),
    chalk.rgb(70, 20, 50).bgRgb(250, 230, 210)(LO_BOX_CHAR),
    chalk.rgb(70, 20, 50)(HI_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
  ],
  [
    chalk.rgb(115, 30, 50).bgRgb(70, 20, 50)(LO_BOX_CHAR),
    chalk.rgb(210, 40, 65).bgRgb(70, 20, 50)(LO_BOX_CHAR),
    chalk.rgb(210, 40, 65).bgRgb(120, 40, 45)(LO_BOX_CHAR),
    chalk.bgRgb(70, 20, 50)(" "),
    chalk.rgb(255, 255, 255).bgRgb(70, 20, 50)(LO_BOX_CHAR),
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    chalk.rgb(250, 230, 210).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    chalk.rgb(250, 230, 210).bgRgb(255, 250, 250)(LO_BOX_CHAR),
    chalk.rgb(70, 20, 50).bgRgb(250, 230, 210)(LO_BOX_CHAR),
    chalk.rgb(135, 45, 45)(HI_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
  ],
  [
    chalk.bgRgb(245, 90, 95)(" "),
    chalk.bgRgb(245, 90, 95)(" "),
    chalk.rgb(70, 20, 50).bgRgb(245, 90, 95)(LO_BOX_CHAR),
    chalk.rgb(255, 255, 255).bgRgb(250, 190, 185)(LO_BOX_CHAR),
    chalk.rgb(250, 240, 225).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    chalk.rgb(250, 235, 220).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    chalk.rgb(255, 255, 255).bgRgb(255, 245, 240)(LO_BOX_CHAR),
    chalk.rgb(255, 255, 255).bgRgb(250, 230, 210)(LO_BOX_CHAR),
    chalk.rgb(200, 80, 20).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    chalk.bgRgb(200, 80, 20)(" "),
    chalk.rgb(70, 20, 50)(LO_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
  ],
  [
    chalk.rgb(255, 255, 255).bgRgb(88, 25, 50)(LO_BOX_CHAR),
    chalk.rgb(255, 255, 255).bgRgb(70, 20, 50)(LO_BOX_CHAR),
    chalk.rgb(250, 150, 140).bgRgb(250, 245, 245)(LO_BOX_CHAR),
    chalk.rgb(255, 255, 255).bgRgb(250, 150, 140)(LO_BOX_CHAR),
    ALL_WHITE,
    ALL_WHITE,
    chalk.rgb(205, 85, 30).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 0).bgRgb(200, 80, 20)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 0).bgRgb(200, 80, 20)(LO_BOX_CHAR),
    ALL_ORANGE,
    chalk.rgb(255, 150, 0).bgRgb(245, 145, 35)(LO_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
  ],
  [
    chalk.rgb(255, 255, 255).bgRgb(250, 230, 215)(LO_BOX_CHAR),
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    chalk.rgb(250, 235, 220).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    ALL_ORANGE,
    chalk.rgb(255, 255, 250).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    ALL_ORANGE,
    ALL_ORANGE,
    chalk.rgb(255, 150, 0).bgRgb(150, 55, 30)(LO_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
  ],
  [
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    chalk.rgb(255, 255, 255).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    ALL_WHITE,
    chalk.rgb(245, 190, 150).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    ALL_ORANGE,
    ALL_ORANGE,
    ALL_ORANGE,
    chalk.rgb(180, 85, 25).bgRgb(70, 20, 50)(LO_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
  ],
  [
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    chalk.rgb(255, 150, 0).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    ALL_ORANGE,
    ALL_ORANGE,
    ALL_ORANGE,
    ALL_ORANGE,
    chalk.rgb(180, 85, 25).bgRgb(245, 140, 2)(LO_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
  ],
  [
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    chalk.rgb(190, 135, 125).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    chalk.rgb(180, 65, 25).bgRgb(245, 145, 35)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 0).bgRgb(240, 135, 0)(LO_BOX_CHAR),
    ALL_ORANGE,
    ALL_ORANGE,
    ALL_ORANGE,
    ALL_ORANGE,
    chalk.rgb(70, 20, 50)(HI_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
  ],
  [
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    chalk.rgb(250, 230, 210).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    chalk.rgb(250, 230, 210).bgRgb(255, 240, 235)(LO_BOX_CHAR),
    chalk.rgb(200, 80, 20).bgRgb(70, 20, 50)(LO_BOX_CHAR),
    ALL_ORANGE,
    ALL_ORANGE,
    ALL_ORANGE,
    ALL_ORANGE,
    ALL_ORANGE,
    chalk.rgb(180, 85, 25)(HI_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
  ],
  [
    chalk.rgb(255, 255, 255)(HI_BOX_CHAR),
    chalk.rgb(250, 230, 210)(HI_BOX_CHAR),
    chalk.rgb(250, 230, 210)(HI_BOX_CHAR),
    chalk.rgb(250, 240, 215)(HI_BOX_CHAR),
    chalk.rgb(70, 20, 50).bgRgb(215, 140, 140)(LO_BOX_CHAR),
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    chalk.rgb(95, 30, 50)(HI_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
  ],
  [
    " ",
    " ",
    " ",
    " ",
    chalk.rgb(70, 20, 50)(HI_BOX_CHAR),
    chalk.rgb(70, 20, 50).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    ALL_WHITE,
    chalk.rgb(255, 240, 230).bgRgb(200, 110, 85)(LO_BOX_CHAR),
    chalk.rgb(220, 165, 140).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    chalk.rgb(195, 135, 120).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
    " ",
  ],
];

const LOGO_SMALL = [
  [
    " ",
    " ",
    " ",
    " ",
    chalk.rgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(250, 230, 210).bgRgb(70, 15, 50)(LO_BOX_CHAR),
    chalk.rgb(210, 38, 65).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.bgRgb(250, 230, 210)(" "),
    " ",
    " ",
  ],
  [
    ALL_WHITE,
    ALL_ORANGE,
    chalk.rgb(255, 150, 0).bgRgb(140, 45, 45)(LO_BOX_CHAR),
    ALL_ORANGE,
    chalk.rgb(250, 230, 210).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(205, 60, 70).bgRgb(210, 38, 65)(LO_BOX_CHAR),
    chalk.rgb(250, 230, 210).bgRgb(250, 150, 140)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 0).bgRgb(250, 230, 210)(LO_BOX_CHAR),
    " ",
    " ",
  ],
  [
    ALL_WHITE,
    chalk.rgb(255, 150, 0).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 0).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    ALL_ORANGE,
    chalk.rgb(255, 150, 0).bgRgb(220, 115, 10)(LO_BOX_CHAR),
    chalk.rgb(200, 80, 20).bgRgb(250, 150, 140)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 0).bgRgb(250, 170, 75)(LO_BOX_CHAR),
    " ",
    " ",
    " ",
  ],
  [
    chalk.rgb(130, 45, 45).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    chalk.rgb(250, 240, 235).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 3).bgRgb(70, 20, 50)(LO_BOX_CHAR),
    chalk.rgb(245, 175, 115).bgRgb(145, 60, 35)(LO_BOX_CHAR),
    chalk.rgb(255, 255, 255).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(250, 145, 0).bgRgb(210, 85, 15)(LO_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
  ],
  [
    chalk.rgb(255, 255, 255).bgRgb(70, 20, 50)(LO_BOX_CHAR),
    chalk.rgb(255, 255, 255).bgRgb(70, 20, 50)(LO_BOX_CHAR),
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    chalk.rgb(250, 230, 210).bgRgb(255, 250, 250)(LO_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
  ],
  [
    chalk.rgb(245, 90, 95).bgRgb(70, 20, 50)(LO_BOX_CHAR),
    chalk.rgb(125, 40, 45).bgRgb(210, 39, 65)(LO_BOX_CHAR),
    chalk.rgb(255, 255, 255).bgRgb(109, 35, 45)(LO_BOX_CHAR),
    ALL_WHITE,
    chalk.rgb(200, 80, 20).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    chalk.rgb(70, 20, 50)(HI_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
  ],
  [
    chalk.rgb(255, 255, 255).bgRgb(80, 20, 50)(LO_BOX_CHAR),
    chalk.rgb(255, 255, 255).bgRgb(250, 195, 180)(LO_BOX_CHAR),
    ALL_WHITE,
    chalk.rgb(250, 210, 185).bgRgb(240, 180, 150)(LO_BOX_CHAR),
    chalk.rgb(245, 190, 155).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 0).bgRgb(200, 90, 15)(LO_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
  ],
  [
    chalk.rgb(255, 255, 255).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    ALL_WHITE,
    ALL_WHITE,
    ALL_WHITE,
    chalk.rgb(255, 150, 0).bgRgb(250, 225, 209)(LO_BOX_CHAR),
    ALL_ORANGE,
    chalk.rgb(70, 20, 50).bgRgb(75, 15, 50)(LO_BOX_CHAR),
    " ",
    " ",
    " ",
  ],
  [
    ALL_WHITE,
    ALL_WHITE,
    chalk.rgb(250, 230, 210).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    chalk.rgb(255, 150, 0).bgRgb(70, 20, 50)(LO_BOX_CHAR),
    ALL_ORANGE,
    chalk.rgb(255, 150, 0).bgRgb(255, 150, 0)(LO_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
  ],
  [
    chalk.rgb(255, 255, 255)(HI_BOX_CHAR),
    " ",
    chalk.rgb(70, 20, 50)(HI_BOX_CHAR),
    ALL_WHITE,
    chalk.rgb(210, 165, 160).bgRgb(255, 255, 255)(LO_BOX_CHAR),
    " ",
    " ",
    " ",
    " ",
    " ",
  ],
];

const LOGO_LINES = LOGO.map((line) => line.slice(1).reverse().join("") + line.join(""));
const LOGO_SMALL_LINES = LOGO_SMALL.map((line) => line.slice(1).reverse().join("") + line.join(""));

const LOGO_WIDTH = 2 * LOGO[0].length - 1;
const LOGO_SMALL_WIDTH = 2 * LOGO_SMALL[0].length - 1;
