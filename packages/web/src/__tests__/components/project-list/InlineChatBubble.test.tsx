import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { InlineChatBubble } from "@/components/project-list/InlineChatBubble";

describe("InlineChatBubble", () => {
  it("renders user role correctly", () => {
    const { container } = render(
      <InlineChatBubble role="user" content="Hello MoRan" />
    );
    const bubbleText = screen.getByText("Hello MoRan");
    expect(bubbleText).toBeInTheDocument();
    
    // User bubble has bg-primary text-primary-foreground
    const bubbleWrapper = container.querySelector(".bg-primary");
    expect(bubbleWrapper).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("justify-end");
  });

  it("renders assistant role correctly", () => {
    const { container } = render(
      <InlineChatBubble role="assistant" content="Hi, how can I help?" />
    );
    const bubbleText = screen.getByText("Hi, how can I help?");
    expect(bubbleText).toBeInTheDocument();
    
    // Assistant bubble has bg-secondary text-secondary-foreground
    const bubbleWrapper = container.querySelector(".bg-secondary");
    expect(bubbleWrapper).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("justify-start");
  });
});
