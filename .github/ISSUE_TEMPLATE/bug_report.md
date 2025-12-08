name: Bug Report
description: Report a bug or issue with Neko
title: "[Bug]: "
labels: ["bug", "triage"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to fill out this bug report!
        Please provide as much detail as possible to help us investigate.

  - type: textarea
    id: description
    attributes:
      label: Bug Description
      description: A clear and concise description of what the bug is.
      placeholder: Describe the bug...
    validations:
      required: true

  - type: textarea
    id: steps
    attributes:
      label: Steps to Reproduce
      description: Steps to reproduce the behavior.
      placeholder: |
        1. Go to '...'
        2. Click on '...'
        3. Scroll down to '...'
        4. See error
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: A clear and concise description of what you expected to happen.
      placeholder: What should have happened?
    validations:
      required: true

  - type: textarea
    id: actual
    attributes:
      label: Actual Behavior
      description: What actually happened instead.
      placeholder: What actually happened?
    validations:
      required: true

  - type: dropdown
    id: os
    attributes:
      label: Operating System
      description: What operating system are you using?
      options:
        - Windows (x64)
        - Windows (ARM64)
        - macOS (Intel)
        - macOS (Apple Silicon)
        - Linux (x64)
        - Linux (ARM64)
        - Other
    validations:
      required: true

  - type: input
    id: version
    attributes:
      label: Neko Version
      description: What version of Neko are you using?
      placeholder: e.g., 1.0.0
    validations:
      required: true

  - type: textarea
    id: logs
    attributes:
      label: Relevant Log Output
      description: Please copy and paste any relevant log output.
      render: shell

  - type: textarea
    id: screenshots
    attributes:
      label: Screenshots
      description: If applicable, add screenshots to help explain your problem.

  - type: textarea
    id: additional
    attributes:
      label: Additional Context
      description: Add any other context about the problem here.

  - type: checkboxes
    id: terms
    attributes:
      label: Checklist
      options:
        - label: I have searched for existing issues that describe my problem
          required: true
        - label: I have provided all the requesd information
          required: true
