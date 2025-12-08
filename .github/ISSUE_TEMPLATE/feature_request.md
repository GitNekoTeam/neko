name: Feature Request
description: Suggest a new feature or enhancement for Neko
title: "[Feature]: "
labels: ["enhancement", "triage"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for suggesting a new feature!
        Please provide as much detail as possible to help us understand your request.

  - type: textarea
    id: problem
    attributes:
      label: Problem Statement
      description: Is your feature request related to a problem? Please describe.
      placeholder: A clear and concise description of what the problem is. Ex. I'm always frustrated when...
    validations:
      required: true

  - type: textarea
    id: solution
    attributes:
      label: Proposed Solution
      description: Describe the solution you'd like.
      placeholder: A clear and concise description of what you want to happen.
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives Considered
      description: Describe any alternative solutions or features you've considered.
      placeholder: What other approaches have you thought about?

  - type: dropdown
    id: category
    attributes:
      label: Feature Category
      description: What area of Neko does this feature relate to?
      options:
        - AI Assistant
        - Code Completion
        - Editor
        - Extensions
        - Build/Packaging
        - Documentation
        - Performance
        - UI/UX
        - Other
    validations:
      required: true

  - type: dropdown
    id: priority
    attributes:
      label: Priority
      description: How important is this feature to you?
      options:
        - Nice to have
        - Important
        - Critical
    validations:
      required: true

  - type: textarea
    id: use-case
    attributes:
      label: Use Case
      description: Describe a specific use case where this feature would be helpful.
      placeholder: When I'm working on..., I would like to...

  - type: textarea
    id: mockups
    attributes:
      label: Mockups/Examples
      description: If applicable, add mockups, screenshots, or examples from other tools.

  - type: textarea
    id: additional
    attributes:
      label: Additional Context
      description: Add any other context about the feature request here.

  - type: checkboxes
    id: terms
    attributes:
      label: Checklist
      options:
        - label: I have searched for existing feature requests
          required: true
        - label: I am willing to help implement this feature
          required: false
