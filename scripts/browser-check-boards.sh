#!/bin/bash
# Прогон симулятора: проверка синхронности досок (обе доски одной длины)
set -u
POSTFLOP=0
BAD=0
declare -a BAD_LOG

js_kind='(() => {
  const spans = [...document.querySelectorAll("span")].filter(s => /^Доска [12]$/.test((s.textContent||"").trim()));
  if (spans.length < 2) return JSON.stringify({kind:"preflop"});
  const info = spans.map(s => {
    const row = s.parentElement;
    const cardRow = [...row.children].find(ch => ch.tagName === "DIV");
    const rowSpans = [...row.querySelectorAll(":scope > span")].map(x => (x.textContent||"").trim());
    return { n: cardRow ? cardRow.children.length : -1, street: rowSpans[rowSpans.length-1] };
  });
  return JSON.stringify({kind:"postflop", b1: info[0], b2: info[1]});
})()'

js_act='(() => {
  const btns = [...document.querySelectorAll("button")];
  const byText = (t) => btns.find(b => (b.textContent||"").trim().startsWith(t));
  const next = byText("Следующая раздача");
  if (next) { next.click(); return "next"; }
  const fold = byText("Фолд");
  if (fold) { fold.click(); return "answered"; }
  return "none";
})()'

for i in $(seq 1 60); do
  OUT=$(agent-browser eval "$js_kind" 2>/dev/null | tr -d '"')
  case "$OUT" in
    *postflop*)
      POSTFLOP=$((POSTFLOP+1))
      B1N=$(echo "$OUT" | grep -o '"n":[0-9-]*' | head -1 | cut -d: -f2)
      B2N=$(echo "$OUT" | grep -o '"n":[0-9-]*' | tail -1 | cut -d: -f2)
      S1=$(echo "$OUT" | grep -o '"street":"[^"]*"' | head -1)
      S2=$(echo "$OUT" | grep -o '"street":"[^"]*"' | tail -1)
      if [ "$B1N" != "$B2N" ] || [ "$S1" != "$S2" ]; then
        BAD=$((BAD+1))
        BAD_LOG+=("iter $i: b1=$B1N b2=$B2N $S1 $S2")
      fi
      ;;
  esac
  agent-browser eval "$js_act" >/dev/null 2>&1
  sleep 0.15
done

echo "Постфлоп-сценариев: $POSTFLOP из 60"
if [ "$BAD" -eq 0 ]; then
  echo "OK: во всех постфлоп-сценариях доски одной длины и одна улица"
else
  echo "FAIL: рассинхрон досок в $BAD случаях:"
  printf '%s\n' "${BAD_LOG[@]}"
  exit 1
fi
