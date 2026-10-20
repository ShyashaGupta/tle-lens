// expect: O(n log n)
int distinct(vector<int>& v) {
    sort(v.begin(), v.end());
    int c = 1;
    for (int i = 1; i < (int)v.size(); i++) if (v[i] != v[i - 1]) c++;
    return c;
}
