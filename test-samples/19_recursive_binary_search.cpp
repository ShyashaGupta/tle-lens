// expect: O(log n)
int bs(vector<int>& a, int lo, int hi, int t) {
    if (lo > hi) return -1;
    int mid = lo + (hi - lo) / 2;
    if (a[mid] == t) return mid;
    if (a[mid] < t) return bs(a, mid + 1, hi, t);
    return bs(a, lo, mid - 1, t);
}
