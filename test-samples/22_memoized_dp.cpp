// expect: O(?)
int climb(int n, vector<int>& memo) {
    if (n <= 1) return 1;
    if (memo[n] != -1) return memo[n];
    return memo[n] = climb(n - 1, memo) + climb(n - 2, memo);
}
