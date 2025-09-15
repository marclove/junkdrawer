#!/usr/bin/env python3
"""
Hook script to protect .notes directory from edits.
Blocks any Write, Edit, or MultiEdit operations targeting files in $CLAUDE_PROJECT_DIR/.notes
"""
import json
import sys
import os
from pathlib import Path

def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
    
    # Get project directory from environment
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR")
    if not project_dir:
        # Fallback to current working directory if not set
        project_dir = input_data.get("cwd", "")
    
    if not project_dir:
        print("Warning: Could not determine project directory", file=sys.stderr)
        sys.exit(0)
    
    # Define the protected notes directory
    notes_dir = Path(project_dir) / ".notes"
    notes_dir_str = str(notes_dir)
    
    # Check for file paths that might be affected
    file_paths = []
    
    if tool_name in ["Write", "Edit"]:
        file_path = tool_input.get("file_path", "")
        if file_path:
            file_paths.append(file_path)
    elif tool_name == "MultiEdit":
        file_path = tool_input.get("file_path", "")
        if file_path:
            file_paths.append(file_path)
    elif tool_name == "NotebookEdit":
        notebook_path = tool_input.get("notebook_path", "")
        if notebook_path:
            file_paths.append(notebook_path)
    
    # Check if any file path is within the protected notes directory
    for file_path in file_paths:
        if file_path:
            try:
                # Resolve to absolute path for accurate comparison
                abs_file_path = Path(file_path).resolve()
                abs_notes_dir = notes_dir.resolve()
                
                # Check if the file is within the notes directory
                if abs_notes_dir in abs_file_path.parents or abs_file_path == abs_notes_dir:
                    # Block the operation using JSON output
                    output = {
                        "hookSpecificOutput": {
                            "hookEventName": "PreToolUse",
                            "permissionDecision": "deny",
                            "permissionDecisionReason": f"Access denied: The .notes directory ({notes_dir_str}) is read-only and protected from modifications. Please choose a different location for your files."
                        }
                    }
                    print(json.dumps(output))
                    sys.exit(0)
                    
            except (OSError, ValueError) as e:
                # If path resolution fails, err on the side of caution
                if ".notes" in file_path:
                    output = {
                        "hookSpecificOutput": {
                            "hookEventName": "PreToolUse", 
                            "permissionDecision": "deny",
                            "permissionDecisionReason": f"Access denied: Files containing '.notes' in the path are protected from modifications."
                        }
                    }
                    print(json.dumps(output))
                    sys.exit(0)
    
    # Allow the operation to proceed
    sys.exit(0)

if __name__ == "__main__":
    main()