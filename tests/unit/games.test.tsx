import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Listening from "@/components/games/Listening";
import QuizChoice from "@/components/games/QuizChoice";
import SentenceBuilder from "@/components/games/SentenceBuilder";
import Unscramble from "@/components/games/Unscramble";
import Writing from "@/components/games/Writing";
import { audioPlayMock, speechMock } from "@/tests/setup";

function handlers() {
  return { onAnswer: vi.fn(), onDone: vi.fn() };
}

/** Question text goes into a RegExp, so its punctuation must be literal. */
function escape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("Unscramble", () => {
  const items = [
    { scrambled: "PHETNALE", answer: "ELEPHANT" },
    { scrambled: "NOIL", answer: "LION" },
  ];

  it("shows the scrambled word and the progress count", () => {
    render(<Unscramble items={items} {...handlers()} />);
    expect(screen.getByText("PHETNALE")).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();
  });

  it("cannot be submitted empty", () => {
    render(<Unscramble items={items} {...handlers()} />);
    expect(screen.getByRole("button", { name: "Check" })).toHaveProperty(
      "disabled",
      true
    );
  });

  it("accepts the answer case-insensitively and with stray spaces", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<Unscramble items={items} {...h} />);

    await user.type(screen.getByLabelText("Your answer"), "  elephant  ");
    await user.click(screen.getByRole("button", { name: "Check" }));

    expect(h.onAnswer).toHaveBeenCalledTimes(1);
    expect(h.onAnswer).toHaveBeenCalledWith(true);
    expect(screen.getByText(/Correct/)).toBeTruthy();
  });

  it("submits with Enter", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<Unscramble items={items} {...h} />);

    await user.type(screen.getByLabelText("Your answer"), "ELEPHANT{Enter}");
    expect(h.onAnswer).toHaveBeenCalledTimes(1);
    expect(h.onAnswer).toHaveBeenCalledWith(true);
  });

  it("reveals the answer when wrong and scores it once only", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<Unscramble items={items} {...h} />);

    await user.type(screen.getByLabelText("Your answer"), "GIRAFFE{Enter}");

    expect(h.onAnswer).toHaveBeenCalledTimes(1);
    expect(h.onAnswer).toHaveBeenCalledWith(false);
    expect(screen.getByText(/Not quite/)).toBeTruthy();
    expect(screen.getByText("ELEPHANT")).toBeTruthy();
    // the input is locked, so a second answer is impossible
    expect(screen.getByLabelText("Your answer")).toHaveProperty("disabled", true);
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
  });

  // The emoji is in colour from the start. It used to be blacked out until the
  // child answered — "whose shadow is this?" — and the teacher had that taken
  // out: this part asks how the word is spelled, not which animal it is.
  it("shows the animal in colour straight away, before any answer", async () => {
    const user = userEvent.setup();
    render(
      <Unscramble
        items={[{ emoji: "🐘", scrambled: "PHETNALE", answer: "ELEPHANT" }]}
        {...handlers()}
      />
    );

    const animal = screen.getByLabelText("elephant");
    expect(animal.textContent).toBe("🐘");
    expect(animal.className).toContain("animal-emoji");
    // nothing left that hides it or asks the child to guess it
    expect(animal.className).not.toMatch(/shadow/);
    expect(screen.queryByText(/shadow/i)).toBeNull();

    await user.type(screen.getByLabelText("Your answer"), "ELEPHANT{Enter}");

    // answering changes the word, not the picture
    expect(screen.getByLabelText("elephant").className).toContain("animal-emoji");
  });

  it("names the animal for a screen reader, in lower case", () => {
    render(
      <Unscramble
        items={[{ emoji: "🦁", scrambled: "NOIL", answer: "LION" }]}
        {...handlers()}
      />
    );
    // a screen reader spells ALL CAPS out letter by letter
    expect(screen.getByLabelText("lion")).toBeTruthy();
    expect(screen.queryByLabelText("LION")).toBeNull();
  });

  it("renders nothing extra when an item has no emoji", () => {
    render(<Unscramble items={items} {...handlers()} />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("advances through items and finishes the block", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<Unscramble items={items} {...h} />);

    await user.type(screen.getByLabelText("Your answer"), "ELEPHANT{Enter}");
    await user.click(screen.getByRole("button", { name: "Next word" }));

    expect(screen.getByText("NOIL")).toBeTruthy();
    expect(screen.getByText("2 / 2")).toBeTruthy();
    expect(screen.getByLabelText("Your answer")).toHaveProperty("value", "");
    expect(h.onDone).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Your answer"), "LION{Enter}");
    await user.click(screen.getByRole("button", { name: "Finish this part" }));

    expect(h.onAnswer).toHaveBeenCalledTimes(2);
    expect(h.onDone).toHaveBeenCalledOnce();
  });
});

describe("QuizChoice", () => {
  const items = [
    {
      clue: "It has a long neck.",
      options: ["Zebra", "Giraffe", "Lion", "Tiger"],
      answerIndex: 1,
    },
    { clue: "It roars.", options: ["Lion", "Mouse"], answerIndex: 0 },
  ];

  it("renders the clue and every option", () => {
    render(<QuizChoice items={items} {...handlers()} />);
    expect(screen.getByText("It has a long neck.")).toBeTruthy();
    for (const option of items[0].options) {
      expect(screen.getByRole("button", { name: new RegExp(option) })).toBeTruthy();
    }
  });

  it("marks a correct pick and locks every option", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<QuizChoice items={items} {...h} />);

    await user.click(screen.getByRole("button", { name: /Giraffe/ }));

    expect(h.onAnswer).toHaveBeenCalledTimes(1);
    expect(h.onAnswer).toHaveBeenCalledWith(true);
    expect(screen.getByText(/Correct/)).toBeTruthy();
    for (const option of items[0].options) {
      expect(
        screen.getByRole("button", { name: new RegExp(option) })
      ).toHaveProperty("disabled", true);
    }
  });

  it("shows the right answer after a wrong pick and only scores once", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<QuizChoice items={items} {...h} />);

    const wrong = screen.getByRole("button", { name: /Zebra/ });
    await user.click(wrong);
    await user.click(wrong); // ignored: one shot per question
    await user.click(screen.getByRole("button", { name: /Lion/ }));

    expect(h.onAnswer).toHaveBeenCalledTimes(1);
    expect(h.onAnswer).toHaveBeenCalledWith(false);
    expect(screen.getByText(/Not quite/)).toBeTruthy();
    expect(wrong.className).toContain("choice--wrong");
    expect(
      screen.getByRole("button", { name: /Giraffe/ }).className
    ).toContain("choice--correct");
  });

  it("moves to the next question and finishes", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<QuizChoice items={items} {...h} />);

    await user.click(screen.getByRole("button", { name: /Giraffe/ }));
    await user.click(screen.getByRole("button", { name: "Next question" }));
    expect(screen.getByText("It roars.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Lion/ }));
    await user.click(screen.getByRole("button", { name: "Finish this part" }));
    expect(h.onDone).toHaveBeenCalledOnce();
  });
});

describe("SentenceBuilder", () => {
  const items = [
    {
      prompt: "Hiss! Hiss!",
      words: ["the", "snake", "hiss", "goes"],
      answer: ["the", "snake", "goes", "hiss"],
    },
  ];

  it("only enables Check once every word is placed", async () => {
    const user = userEvent.setup();
    render(<SentenceBuilder items={items} {...handlers()} />);

    const check = () => screen.getByRole("button", { name: "Check" });
    expect(check()).toHaveProperty("disabled", true);

    for (const word of ["the", "snake", "goes"]) {
      await user.click(screen.getByRole("button", { name: word }));
    }
    expect(check()).toHaveProperty("disabled", true);

    await user.click(screen.getByRole("button", { name: "hiss" }));
    expect(check()).toHaveProperty("disabled", false);
  });

  it("scores the right order as correct", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<SentenceBuilder items={items} {...h} />);

    for (const word of ["the", "snake", "goes", "hiss"]) {
      await user.click(screen.getByRole("button", { name: word }));
    }
    await user.click(screen.getByRole("button", { name: "Check" }));

    expect(h.onAnswer).toHaveBeenCalledTimes(1);
    expect(h.onAnswer).toHaveBeenCalledWith(true);
  });

  it("scores the wrong order as wrong and shows the sentence", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<SentenceBuilder items={items} {...h} />);

    for (const word of ["the", "snake", "hiss", "goes"]) {
      await user.click(screen.getByRole("button", { name: word }));
    }
    await user.click(screen.getByRole("button", { name: "Check" }));

    expect(h.onAnswer).toHaveBeenCalledTimes(1);
    expect(h.onAnswer).toHaveBeenCalledWith(false);
    expect(screen.getByText("the snake goes hiss")).toBeTruthy();
  });

  it("lets a word be taken back out and cleared", async () => {
    const user = userEvent.setup();
    render(<SentenceBuilder items={items} {...handlers()} />);

    await user.click(screen.getByRole("button", { name: "the" }));
    await user.click(screen.getByRole("button", { name: "snake" }));
    expect(screen.getByRole("button", { name: "Clear" })).toHaveProperty(
      "disabled",
      false
    );

    // tapping a placed word returns it to the pool
    await user.click(screen.getByRole("button", { name: "the" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("button", { name: "Clear" })).toHaveProperty(
      "disabled",
      true
    );
    expect(screen.getByText("Your sentence appears here")).toBeTruthy();
  });

  // Two identical words must be tracked by position, not by text.
  it("handles a sentence with a repeated word", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(
      <SentenceBuilder
        items={[
          {
            prompt: "repeat",
            words: ["the", "the", "cat", "sees"],
            answer: ["the", "cat", "sees", "the"],
          },
        ]}
        {...h}
      />
    );

    const pick = (name: string, nth = 0) =>
      screen.getAllByRole("button", { name })[nth];

    await user.click(pick("the"));
    await user.click(pick("cat"));
    await user.click(pick("sees"));
    await user.click(pick("the", 1)); // second "the" is still in the pool
    await user.click(screen.getByRole("button", { name: "Check" }));

    expect(h.onAnswer).toHaveBeenCalledTimes(1);
    expect(h.onAnswer).toHaveBeenCalledWith(true);
  });

  it("compares case-insensitively", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(
      <SentenceBuilder
        items={[{ prompt: "p", words: ["The", "cat"], answer: ["the", "CAT"] }]}
        {...h}
      />
    );

    await user.click(screen.getByRole("button", { name: "The" }));
    await user.click(screen.getByRole("button", { name: "cat" }));
    await user.click(screen.getByRole("button", { name: "Check" }));

    expect(h.onAnswer).toHaveBeenCalledTimes(1);
    expect(h.onAnswer).toHaveBeenCalledWith(true);
  });
});

describe("Listening", () => {
  const withAudio = [
    {
      audioUrl: "unit-02/clue-1.mp3",
      clueText: "I can breathe fire.",
      options: ["Unicorn", "Dragon"],
      answerIndex: 1,
    },
  ];
  const withoutAudio = [
    {
      audioUrl: "",
      clueText: "I have a long neck.",
      options: ["Giraffe", "Lion"],
      answerIndex: 0,
    },
  ];

  it("hides the clue text until asked", async () => {
    const user = userEvent.setup();
    render(<Listening items={withAudio} {...handlers()} />);

    expect(screen.queryByText("I can breathe fire.")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Show text/ }));
    expect(screen.getByText("I can breathe fire.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Hide text/ }));
    expect(screen.queryByText("I can breathe fire.")).toBeNull();
  });

  it("plays the mp3 and does not use the browser voice", async () => {
    const user = userEvent.setup();
    render(<Listening items={withAudio} {...handlers()} />);

    expect(screen.queryByText(/no recording yet/)).toBeNull();
    await user.click(screen.getByRole("button", { name: /Play the clue/ }));

    expect(audioPlayMock).toHaveBeenCalled();
    expect(speechMock.speak).not.toHaveBeenCalled();
  });

  it("resolves a relative audioUrl under /audio/", () => {
    const { container } = render(<Listening items={withAudio} {...handlers()} />);
    const audio = container.querySelector("audio");
    expect(audio?.getAttribute("src")).toBe("/audio/unit-02/clue-1.mp3");
  });

  it("passes an absolute audioUrl through untouched", () => {
    const { container } = render(
      <Listening
        items={[{ ...withAudio[0], audioUrl: "https://cdn.example/clue.mp3" }]}
        {...handlers()}
      />
    );
    expect(container.querySelector("audio")?.getAttribute("src")).toBe(
      "https://cdn.example/clue.mp3"
    );
  });

  it("falls back to speech synthesis when there is no audioUrl", async () => {
    const user = userEvent.setup();
    const { container } = render(<Listening items={withoutAudio} {...handlers()} />);

    expect(container.querySelector("audio")).toBeNull();
    expect(screen.getByText(/no recording yet/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Play the clue/ }));
    expect(speechMock.speak).toHaveBeenCalledOnce();
    expect(audioPlayMock).not.toHaveBeenCalled();
  });

  it("falls back to speech synthesis when the file fails to load", async () => {
    const user = userEvent.setup();
    const { container } = render(<Listening items={withAudio} {...handlers()} />);

    const audio = container.querySelector("audio")!;
    audio.dispatchEvent(new Event("error"));

    expect(await screen.findByText(/no recording yet/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Play the clue/ }));
    expect(speechMock.speak).toHaveBeenCalledOnce();
  });

  it("scores one answer per clue and stops any speech", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<Listening items={withAudio} {...h} />);

    await user.click(screen.getByRole("button", { name: /Dragon/ }));
    await user.click(screen.getByRole("button", { name: /Unicorn/ }));

    expect(h.onAnswer).toHaveBeenCalledTimes(1);
    expect(h.onAnswer).toHaveBeenCalledWith(true);
    expect(speechMock.cancel).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Finish this part" }));
    expect(h.onDone).toHaveBeenCalledOnce();
  });
});

describe("Writing", () => {
  const prompt = { questions: ["Your spirit animal?", "Why?", "Where?"] };

  it("renders one textarea per question and says it is not scored", () => {
    render(<Writing prompt={prompt} onDone={vi.fn()} />);

    for (const question of prompt.questions) {
      expect(screen.getByLabelText(new RegExp(escape(question)))).toBeTruthy();
    }
    expect(screen.getByText(/Not scored/)).toBeTruthy();
    expect(screen.getByText(/Copy it down/)).toBeTruthy();
  });

  it("keeps each answer in its own box and counts what has been written", async () => {
    const user = userEvent.setup();
    render(<Writing prompt={prompt} onDone={vi.fn()} />);

    expect(screen.getByText("0 / 3")).toBeTruthy();

    await user.type(screen.getByLabelText(/Your spirit animal/), "Owl");
    await user.type(screen.getByLabelText(/Why\?/), "Wise");

    expect(screen.getByLabelText(/Your spirit animal/)).toHaveProperty(
      "value",
      "Owl"
    );
    expect(screen.getByLabelText(/Why\?/)).toHaveProperty("value", "Wise");
    expect(screen.getByLabelText(/Where\?/)).toHaveProperty("value", "");
    expect(screen.getByText("2 / 3")).toBeTruthy();
  });

  it("finishes without an empty-field check â€” it is practice, not a test", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<Writing prompt={prompt} onDone={onDone} />);

    await user.click(screen.getByRole("button", { name: /Finish and see my score/ }));
    expect(onDone).toHaveBeenCalledOnce();
  });
});
