# Time complexity

1. Time complexity describes how the work an algorithm does grows as its input grows, written in Big-O notation.
2. Common classes from fastest to slowest growth are O(1), O(log n), O(n), O(n log n) and O(n squared).
3. Two nested loops over the same n items do about n squared steps; for a million items that is a trillion steps.
4. Checking array.includes inside a loop over another array is O(n squared); putting the values in a Set first makes each lookup O(1) on average, so the whole thing is O(n).
5. Binary search on a sorted array is O(log n): it halves the remaining range on every step.
6. Big-O ignores constant factors, so for small inputs a simpler O(n squared) solution can be perfectly fine.
