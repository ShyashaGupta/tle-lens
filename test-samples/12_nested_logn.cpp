// expect: O(n log n)
int harmonic(int n) {
    int c = 0;
    for (int i = 0; i < n; i++)
        for (int j = 1; j < n; j *= 2) c++;
    return c;
}
