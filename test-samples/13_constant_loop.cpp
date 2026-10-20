// expect: O(1)
int small() {
    int s = 0;
    for (int i = 0; i < 5; i++) s += i;
    return s;
}
