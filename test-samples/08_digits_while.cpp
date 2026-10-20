// expect: O(log n)
int digits(int n) {
    int c = 0;
    while (n > 0) { c++; n /= 10; }
    return c;
}
