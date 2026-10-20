// expect: O(n log n)
void quickSort(vector<int>& a, int lo, int hi) {
    if (lo >= hi) return;
    int pivot = a[hi], i = lo;
    for (int j = lo; j < hi; j++)
        if (a[j] < pivot) swap(a[i++], a[j]);
    swap(a[i], a[hi]);
    quickSort(a, lo, i - 1);
    quickSort(a, i + 1, hi);
}
