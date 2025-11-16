if git worktree add "$WORKTREE_PATH"; then
echo "worktree 생성 성공: SINORKTREE_PATH"
cd "$WORKTREE_PATH" || exit 1 # Use exit for standalone scripts
echo 디렉터리 변경 완료 : $(pnd)"
# Extract the number from the argument
# This assumes the number is the last part after the last hyphen
# Example: "feature-branch-123" will extract "123"
ISSUE_NUMBER=$(echo "$ARGUMENT" | awk -F'-' '{print $NF}')
# Check if ISSUE_NUMBER is a valid number (optional, but good practice)
if [[ "$ISSUE_NUMBER" =~ ^[0-9]+$ 11; then echo "Running claude command for issue: $ISSUE_NUMBER" claude -p "/user: resolve-issue $ISSUE_NUMBER"
else
echo "Warning: Could not extract a valid issue number from '$ARGUMENT'. Skipping
claude command. "
fi
else
echo "worktree 생성 실패."
exit 1 # Use exit for standalone scripts
fi