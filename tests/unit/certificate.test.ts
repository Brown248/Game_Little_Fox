import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadCertificate } from "@/lib/certificate";

// jspdf is stubbed so the test can assert what gets drawn and what the file is
// called, without a real PDF or a jsdom download.
const calls = {
  text: [] as { text: string; x: number; y: number }[],
  save: [] as string[],
  options: [] as unknown[],
  circles: 0,
  dashPatterns: [] as number[][],
  images: [] as {
    data: unknown;
    format: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }[],
};

vi.mock("jspdf", () => ({
  jsPDF: class {
    internal = {
      // A5 landscape
      pageSize: { getWidth: () => 210, getHeight: () => 148 },
    };
    constructor(options: unknown) {
      calls.options.push(options);
    }
    setFillColor() {}
    setDrawColor() {}
    setLineWidth() {}
    setTextColor() {}
    setFont() {}
    setFontSize() {}
    setLineDashPattern(pattern: number[]) {
      calls.dashPatterns.push(pattern);
    }
    rect() {}
    roundedRect() {}
    line() {}
    triangle() {}
    circle() {
      calls.circles += 1;
    }
    addImage(
      data: unknown,
      format: string,
      x: number,
      y: number,
      w: number,
      h: number
    ) {
      calls.images.push({ data, format, x, y, w, h });
    }
    text(text: string, x: number, y: number) {
      calls.text.push({ text, x, y });
    }
    save(name: string) {
      calls.save.push(name);
    }
  },
}));

const data = {
  name: "Mint Suwan",
  unitId: "unit-02",
  unitTitle: "Wild Life and Wonderful Creatures",
  score: 40,
  maxScore: 60,
  timeSeconds: 187,
  accuracy: 40 / 60,
};

/** Letters are spaced out for the small caps labels, so match on that form. */
const spaced = (value: string) => value.split("").join(" ");

const printed = () => calls.text.map((c) => c.text);

/** The logo is fetched at download time, so every test needs to say what the
 *  network does. Default: it works. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function serveLogo(bytes = PNG_SIGNATURE) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        // the body must be the bytes themselves — jsdom's Blob is not the Blob
        // this Response understands, and it quietly stringifies it instead
        new Response(new Uint8Array(bytes), {
          headers: { "content-type": "image/png" },
        })
    )
  );
}

beforeEach(() => {
  calls.text = [];
  calls.save = [];
  calls.options = [];
  calls.circles = 0;
  calls.dashPatterns = [];
  calls.images = [];
  serveLogo();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("certificate", () => {
  it("draws an A5 landscape page", async () => {
    await downloadCertificate(data);
    expect(calls.options[0]).toMatchObject({
      orientation: "landscape",
      format: "a5",
      unit: "mm",
    });
  });

  it("prints the club line, the title and the explorer's name", async () => {
    await downloadCertificate(data);

    expect(printed()).toContain(spaced("LITTLE FOX LANGUAGE SCHOOL"));
    expect(printed()).toContain("Certificate of Expedition");
    expect(printed()).toContain("awarded to");
    expect(printed()).toContain("Mint Suwan");
  });

  it("says which unit was completed", async () => {
    await downloadCertificate(data);
    expect(
      printed().some((t) =>
        t.includes("unit 02") && t.includes("Wild Life and Wonderful Creatures")
      )
    ).toBe(true);
  });

  it("prints score, time and accuracy as separate columns", async () => {
    await downloadCertificate(data);

    expect(printed()).toContain(spaced("SCORE"));
    expect(printed()).toContain("40 / 60");
    expect(printed()).toContain(spaced("TIME"));
    expect(printed()).toContain("3:07");
    expect(printed()).toContain(spaced("ACCURACY"));
    expect(printed()).toContain("67%");
  });

  it("adds the class rank column only when the rank is known", async () => {
    await downloadCertificate(data);
    expect(printed()).not.toContain(spaced("CLASS RANK"));

    calls.text = [];
    await downloadCertificate({ ...data, rankLabel: "3 / 24" });
    expect(printed()).toContain(spaced("CLASS RANK"));
    expect(printed()).toContain("3 / 24");
  });

  it("stamps a seal carrying the unit, drawn with dashed rings", async () => {
    await downloadCertificate(data);
    expect(printed()).toContain(spaced("UNIT 02"));
    expect(calls.circles).toBeGreaterThanOrEqual(2);
    // dashes are turned on for the frame and seal, then always reset to solid
    expect(calls.dashPatterns.some((p) => p.length === 2)).toBe(true);
    expect(calls.dashPatterns.at(-1)).toEqual([]);
  });

  it("stamps the school logo at the head of the page", async () => {
    await downloadCertificate(data);

    expect(calls.images).toHaveLength(1);
    const [logo] = calls.images;
    expect(logo.format).toBe("PNG");
    // Raw bytes, never a data URL: jspdf mis-decodes the data-URL form of this
    // file and throws "Incomplete or corrupt PNG file".
    expect(logo.data).toBeInstanceOf(Uint8Array);
    expect([...(logo.data as Uint8Array)]).toEqual(PNG_SIGNATURE);
    // square, centred on a 210mm page, above the issuer line at y=42
    expect(logo.w).toBe(logo.h);
    expect(logo.x + logo.w / 2).toBeCloseTo(105);
    expect(logo.y + logo.h).toBeLessThan(42);
  });

  it("takes the print cut, not the on-screen logo", async () => {
    await downloadCertificate(data);
    // the transparent 512px one turns a 93KB certificate into a 1MB download
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/little-fox-logo-print.png");
  });

  // A child who has just finished a unit is waiting for this file. A logo that
  // will not load is not a good enough reason to hand them nothing.
  it("still produces the certificate when the logo cannot be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    await downloadCertificate(data);
    expect(calls.images).toHaveLength(0);
    expect(printed()).toContain("Mint Suwan");
    expect(calls.save[0]).toBe("little-fox-unit-02-mint-suwan.pdf");

    calls.save = [];
    calls.text = [];
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await downloadCertificate(data);
    expect(calls.images).toHaveLength(0);
    expect(calls.save[0]).toBe("little-fox-unit-02-mint-suwan.pdf");
  });

  it("prints teacher and date lines", async () => {
    await downloadCertificate(data);
    expect(printed()).toContain(spaced("TEACHER"));
    expect(printed().some((t) => /\d/.test(t) && t.includes(" "))).toBe(true);
  });

  it("names the file after the unit and student", async () => {
    await downloadCertificate(data);
    expect(calls.save[0]).toBe("little-fox-unit-02-mint-suwan.pdf");
  });

  it("falls back to a usable filename when the name has no ASCII letters", async () => {
    await downloadCertificate({ ...data, name: "มิ้นท์" });
    expect(calls.save[0]).toBe("little-fox-unit-02-student.pdf");
  });

  it("handles a zero score without dividing by zero", async () => {
    await downloadCertificate({ ...data, score: 0, maxScore: 0, accuracy: 0 });
    expect(printed()).toContain("0 / 0");
    expect(printed()).toContain("0%");
  });
});
