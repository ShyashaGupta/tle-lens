// n <= 2e5
int slow(vector<int>& a) {
    int c = 0;
    for (int i = 0; i < a.size(); i++)
        for (int j = 0; j < a.size(); j++) c++;
    return c;
}

// n <= 2e5
void fast(vector<int>& a) {
    sort(a.begin(), a.end());
}
