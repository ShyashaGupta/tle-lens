// expect: O(log n)
int steps(int n) {
    int c = 0;
    for (int i = 1; i < n; i *= 2) c++;
    return c;
}
