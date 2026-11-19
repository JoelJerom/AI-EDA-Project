# AI-EDA-Project

An AI-powered circuit design web tool: describe a circuit in plain language and get a design, or upload an existing design and get it scored and improved.

# Overview

AI-EDA-Project is a web-based electronic design assistant aimed at people who want to design circuits without deep EDA (electronic design automation) expertise. It combines prompt-based circuit generation with automated design review, so users can go from an idea to a working circuit, or from a rough design to a better one.

# Features
Prompt-to-design: Describe what you need (for example, “a 5V to 3.3V regulator for a battery-powered sensor”) and the tool generates a circuit.
Circuit scoring: Upload a circuit design file and receive a score for the design.
AI suggestions: Get recommendations for changes, including better component choices that improve efficiency, sustainability and cost while keeping performance high.
Circuit simplification: Identify redundant or overcomplicated parts of an existing design and reduce them.
Manual and AI-assisted design: Build circuits by hand or let the AI draft them, then refine.

# How it works

The core circuit-engine module is guided by a rulebook covering 13 core circuit building blocks (such as linear and switching regulators). The engine uses these rules to generate, evaluate and critique designs.
