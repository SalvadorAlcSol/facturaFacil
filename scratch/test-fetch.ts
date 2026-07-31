async function test() {
  const res = await fetch("http://localhost:3000/api/drive-status");
  console.log("Status:", res.status);
  console.log("Headers:", Object.fromEntries(res.headers.entries()));
  const text = await res.text();
  console.log("Body snippet:", text.substring(0, 500));
}
test();
