// expect: O(n²)
// func: maxSub
class Solution {
public:
    int maxSub(vector<int>& a) {
        int best = 0;
        for (int i = 0; i < (int)a.size(); i++) {
            int s = 0;
            for (int j = i; j < (int)a.size(); j++) { s += a[j]; best = max(best, s); }
        }
        return best;
    }
};
