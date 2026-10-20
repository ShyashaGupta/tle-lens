// expect: O(2ⁿ)
void permute(vector<int>& a, int k) {
    if (k == (int)a.size()) return;
    for (int i = k; i < (int)a.size(); i++) {
        swap(a[k], a[i]);
        permute(a, k + 1);
        swap(a[k], a[i]);
    }
}
