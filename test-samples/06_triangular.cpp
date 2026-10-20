// expect: O(n²)
int pairs(vector<int>& a) {
    int n = a.size(), c = 0;
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j < n; j++)
            if (a[i] + a[j] == 10) c++;
    return c;
}
