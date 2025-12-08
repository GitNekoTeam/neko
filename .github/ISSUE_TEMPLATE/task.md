name: Task
description: Create a task or work item for the Neko project
title: "[Task]: "
labels: ["task"]
body:
  - type: markdown
    attributes:
      value: |
        Use this template to create a task or work item for the Neko project.
        Tasks are typically internal work items that need to be completed.

  - type: textarea
    id: description
    attributes:
      label: Task Description
      description: A clear and concise description of the task.
      placeholder: Describe what needs to be done...
    validations:
      required: true

  - type: textarea
    id: acceptance
    attributes:
      label: Acceptance Criteria
      description: What conditions must be met for this task to be considered complete?
      placeholder: |
        - [ ] Criterion 1
        - [ ] Criterion 2
        - [ ] Criterion 3
    validations:
      required: true

  - type: dropdown
    id: type
    attributes:
      label: Task Type
      description: What type of task is this?
      options:
        - Development
        - Documentation
        - Testing
        - Refactoring
        - Infrastructure
        - Research
        - Design
        - Other
    validations:
      required: true

  - type: dropdown
    id: priority
    attributes:
      label: Priority
      description: How urgent is this task?
      options:
        - Low
        - Medium
        - High
        - Critical
    validations:
      required: true

  - type: dropdown
    id: effort
    attributes:
      label: Estimated Effort
      description: How much effort do you estimate this task will require?
      options:
        - Small (< 1 day)
        - Medium (1-3 days)
        - Large (3-7 days)
        - Extra Large (> 1 week)

  - type: textarea
    id: dependencies
    attributes:
      label: Dependencies
      description: Are there any other issues or tasks that this depends on?
      placeholder: "Related to #123, blocked by #456"

  - type: textarea
    id: technical
    attributes:
      label: Technical Details
      description: Any technical details or implementation notes.
      placeholder: Technical considerations, affected files, etc.

  - type: textarea
    id: additional
    attributes:
      label: Additional Context
      description: Add any other context about the task here.

  - type: checkboxes
    id: terms
    attributes:
      label: Checklist
      options:
        - label: I have checked that this task does not duplicate existing work
          required: true
