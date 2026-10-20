// expect: O(n²)
void bubble(vector<int>& a) {
    int n = a.size();
    for (int i = 0; i < n; i++)
        for (int j = 0; j + 1 < n - i; j++)
            if (a[j] > a[j + 1]) swap(a[j], a[j + 1]);
}
