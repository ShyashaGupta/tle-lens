// expect: O(n)
long long total(vector<int>& a) {
    long long s = 0;
    for (int i = 0; i < (int)a.size(); i++) s += a[i];
    return s;
}
