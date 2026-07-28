# clickup-mcp

> Generated from repository-local OKF records. The Markdown/YAML bundle remains canonical.

Source: `clickup-mcp`

The report separates the connected repository map from detailed component and key-concept views so large bundles remain reviewable.

## Connected-area overview

```mermaid
flowchart LR
    a0["docs · 39 concepts"]
    a1["repository root · 3 concepts"]
    a2["tasks · 1 concepts"]
    a0 -->|links| a1
    a0 -->|links| a2
    a1 -->|links| a0
    a2 -->|links| a0
    classDef default fill:#eef2ff,stroke:#4f46e5,color:#1e1b4b
```

## Connected component 1

### docs

```mermaid
flowchart LR
    n0["Architecture"]:::boundary
    n1["Archive"]:::knowledge
    n2["Codebase Map"]:::knowledge
    n3["Configuration"]:::knowledge
    n4["Correct Endpoints and Functionality"]:::knowledge
    n5["0001 Platform Status Model"]:::knowledge
    n6["0002 Evidence Freshness And Validation"]:::knowledge
    n7["0003 Status Actionability"]:::knowledge
    n8["0004 Canonical Status Artefact"]:::knowledge
    n9["0005 Canonical Status Schema"]:::knowledge
    n10["Auth Principles"]:::knowledge
    n11["Core Beliefs"]:::knowledge
    n12["Tool Contract Principles"]:::knowledge
    n13["Validation Harness Principles"]:::knowledge
    n14["Write Safety Principles"]:::knowledge
    n15["Design"]:::knowledge
    n16["Active Execution Plans"]:::knowledge
    n17["Runtime Repair Plan"]:::knowledge
    n18["Harness Engineering Plan"]:::knowledge
    n19["Tech Debt Tracker"]:::knowledge
    n20["clickup-mcp complete Markdown inventory"]:::knowledge
    n21["clickup-mcp documentation map"]:::knowledge
    n22["clickup-mcp repository OKF visualization"]:::knowledge
    n23["Live Runtime Tool Tests"]:::knowledge
    n24["Live Smoke Harness"]:::knowledge
    n25["Live Verification: Initial Pass"]:::knowledge
    n26["Manifest vs Runtime Drift"]:::knowledge
    n27["Non-Live Validation Probe"]:::knowledge
    n28["Plans"]:::knowledge
    n29["Tool Availability Policy"]:::knowledge
    n30["Tool Trust Model"]:::knowledge
    n31["Product Sense"]:::knowledge
    n32["Public Spec Comparison"]:::knowledge
    n33["Quality Score"]:::knowledge
    n34["Refactor and Repair Plan"]:::knowledge
    n35["Reliability"]:::knowledge
    n36["Security"]:::knowledge
    n37["Status Artefacts"]:::knowledge
    n38["Tool Reference"]:::knowledge
    n39["Unmatched Endpoint Classification"]:::knowledge
    n40["Glossary"]:::boundary
    n41["ClickUp MCP"]:::boundary
    n42["Adopt RKE OKF knowledge format · done"]:::boundary
    n0 -->|links| n2
    n0 -->|links| n34
    n0 -->|links| n21
    n1 -->|links| n28
    n1 -->|links| n21
    n2 -->|links| n38
    n2 -->|links| n3
    n2 -->|links| n21
    n3 -->|links| n10
    n3 -->|links| n14
    n3 -->|links| n24
    n3 -->|links| n2
    n3 -->|links| n27
    n3 -->|links| n21
    n4 -->|links| n21
    n5 -->|links| n21
    n6 -->|links| n21
    n7 -->|links| n21
    n8 -->|links| n21
    n9 -->|links| n21
    n10 -->|links| n21
    n11 -->|links| n21
    n12 -->|links| n26
    n12 -->|links| n21
    n13 -->|links| n21
    n14 -->|links| n21
    n15 -->|links| n21
    n16 -->|links| n21
    n17 -->|links| n23
    n17 -->|links| n4
    n17 -->|links| n21
    n18 -->|links| n24
    n18 -->|links| n21
    n19 -->|links| n21
    n20 -->|links| n0
    n20 -->|links| n1
    n20 -->|links| n2
    n20 -->|links| n3
    n20 -->|links| n4
    n20 -->|links| n5
    n20 -->|links| n6
    n20 -->|links| n7
    n20 -->|links| n8
    n20 -->|links| n9
    n20 -->|links| n10
    n20 -->|links| n11
    n20 -->|links| n12
    n20 -->|links| n13
    n20 -->|links| n14
    n20 -->|links| n15
    n20 -->|links| n16
    n20 -->|links| n17
    n20 -->|links| n18
    n20 -->|links| n19
    n20 -->|links| n21
    n20 -->|links| n22
    n20 -->|links| n23
    n20 -->|links| n24
    n20 -->|links| n25
    n20 -->|links| n26
    n20 -->|links| n27
    n20 -->|links| n28
    n20 -->|links| n29
    n20 -->|links| n30
    n20 -->|links| n31
    n20 -->|links| n32
    n20 -->|links| n33
    n20 -->|links| n34
    n20 -->|links| n35
    n20 -->|links| n36
    n20 -->|links| n37
    n20 -->|links| n38
    n20 -->|links| n39
    n20 -->|links| n40
    n20 -->|links| n41
    n20 -->|links| n42
    n21 -->|links| n41
    n21 -->|links| n20
    n21 -->|links| n0
    n21 -->|links| n2
    n21 -->|links| n1
    n21 -->|links| n5
    n21 -->|links| n6
    n21 -->|links| n7
    n21 -->|links| n8
    n21 -->|links| n9
    n21 -->|links| n17
    n21 -->|links| n18
    n21 -->|links| n19
    n21 -->|links| n28
    n21 -->|links| n34
    n21 -->|links| n11
    n21 -->|links| n14
    n21 -->|links| n15
    n21 -->|links| n40
    n21 -->|links| n16
    n21 -->|links| n37
    n21 -->|links| n12
    n21 -->|links| n29
    n21 -->|links| n30
    n21 -->|links| n33
    n21 -->|links| n3
    n21 -->|links| n38
    n21 -->|links| n35
    n21 -->|links| n4
    n21 -->|links| n23
    n21 -->|links| n26
    n21 -->|links| n31
    n21 -->|links| n32
    n21 -->|links| n39
    n21 -->|links| n10
    n21 -->|links| n36
    n21 -->|links| n13
    n21 -->|links| n24
    n21 -->|links| n25
    n21 -->|links| n27
    n21 -->|links| n42
    n21 -->|links| n22
    n22 -->|links| n21
    n22 -->|links| n20
    n22 -->|links| n42
    n23 -->|links| n21
    n24 -->|links| n21
    n25 -->|links| n21
    n26 -->|links| n21
    n27 -->|links| n21
    n28 -->|links| n38
    n28 -->|links| n41
    n28 -->|links| n17
    n28 -->|links| n18
    n28 -->|links| n34
    n28 -->|links| n21
    n29 -->|links| n38
    n29 -->|links| n34
    n29 -->|links| n21
    n30 -->|links| n21
    n31 -->|links| n21
    n32 -->|links| n21
    n33 -->|links| n21
    n34 -->|links| n18
    n34 -->|links| n2
    n34 -->|links| n27
    n34 -->|links| n26
    n34 -->|links| n32
    n34 -->|links| n39
    n34 -->|links| n25
    n34 -->|links| n23
    n34 -->|links| n4
    n34 -->|links| n38
    n34 -->|links| n3
    n34 -->|links| n41
    n34 -->|links| n21
    n35 -->|links| n23
    n35 -->|links| n4
    n35 -->|links| n21
    n36 -->|links| n10
    n36 -->|links| n14
    n36 -->|links| n3
    n36 -->|links| n21
    n37 -->|links| n38
    n37 -->|links| n21
    n38 -->|links| n23
    n38 -->|links| n4
    n38 -->|links| n26
    n38 -->|links| n27
    n38 -->|links| n34
    n38 -->|links| n2
    n38 -->|links| n21
    n39 -->|links| n21
    n40 -->|links| n21
    n41 -->|links| n3
    n41 -->|links| n38
    n41 -->|links| n0
    n41 -->|links| n21
    n42 -->|links| n21
    n42 -->|links| n22
    classDef task fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef workstream fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef tracker fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef knowledge fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef boundary fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-dasharray:4 3
```

### repository root

```mermaid
flowchart LR
    n0["Architecture"]:::knowledge
    n1["Codebase Map"]:::boundary
    n2["Configuration"]:::boundary
    n3["clickup-mcp complete Markdown inventory"]:::boundary
    n4["clickup-mcp documentation map"]:::boundary
    n5["Plans"]:::boundary
    n6["Refactor and Repair Plan"]:::boundary
    n7["Tool Reference"]:::boundary
    n8["Glossary"]:::knowledge
    n9["ClickUp MCP"]:::knowledge
    n0 -->|links| n1
    n0 -->|links| n6
    n0 -->|links| n4
    n1 -->|links| n7
    n1 -->|links| n2
    n1 -->|links| n4
    n2 -->|links| n1
    n2 -->|links| n4
    n3 -->|links| n0
    n3 -->|links| n1
    n3 -->|links| n2
    n3 -->|links| n4
    n3 -->|links| n5
    n3 -->|links| n6
    n3 -->|links| n7
    n3 -->|links| n8
    n3 -->|links| n9
    n4 -->|links| n9
    n4 -->|links| n3
    n4 -->|links| n0
    n4 -->|links| n1
    n4 -->|links| n5
    n4 -->|links| n6
    n4 -->|links| n8
    n4 -->|links| n2
    n4 -->|links| n7
    n5 -->|links| n7
    n5 -->|links| n9
    n5 -->|links| n6
    n5 -->|links| n4
    n6 -->|links| n1
    n6 -->|links| n7
    n6 -->|links| n2
    n6 -->|links| n9
    n6 -->|links| n4
    n7 -->|links| n6
    n7 -->|links| n1
    n7 -->|links| n4
    n8 -->|links| n4
    n9 -->|links| n2
    n9 -->|links| n7
    n9 -->|links| n0
    n9 -->|links| n4
    classDef task fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef workstream fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef tracker fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef knowledge fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef boundary fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-dasharray:4 3
```

### tasks

```mermaid
flowchart LR
    n0["clickup-mcp complete Markdown inventory"]:::boundary
    n1["clickup-mcp documentation map"]:::boundary
    n2["clickup-mcp repository OKF visualization"]:::boundary
    n3["Adopt RKE OKF knowledge format · done"]:::task
    n0 -->|links| n1
    n0 -->|links| n2
    n0 -->|links| n3
    n1 -->|links| n0
    n1 -->|links| n3
    n1 -->|links| n2
    n2 -->|links| n1
    n2 -->|links| n0
    n2 -->|links| n3
    n3 -->|links| n1
    n3 -->|links| n2
    classDef task fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef workstream fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef tracker fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef knowledge fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef boundary fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-dasharray:4 3
```

## Key concept neighbourhoods

### clickup-mcp documentation map

```mermaid
flowchart LR
    n0["Architecture"]:::boundary
    n1["Archive"]:::boundary
    n2["Codebase Map"]:::boundary
    n3["Configuration"]:::boundary
    n4["Correct Endpoints and Functionality"]:::boundary
    n5["0001 Platform Status Model"]:::boundary
    n6["0002 Evidence Freshness And Validation"]:::boundary
    n7["0003 Status Actionability"]:::boundary
    n8["0004 Canonical Status Artefact"]:::boundary
    n9["0005 Canonical Status Schema"]:::boundary
    n10["Auth Principles"]:::boundary
    n11["Core Beliefs"]:::boundary
    n12["Tool Contract Principles"]:::boundary
    n13["Validation Harness Principles"]:::boundary
    n14["Write Safety Principles"]:::boundary
    n15["Design"]:::boundary
    n16["Active Execution Plans"]:::boundary
    n17["Runtime Repair Plan"]:::boundary
    n18["Harness Engineering Plan"]:::boundary
    n19["Tech Debt Tracker"]:::boundary
    n20["clickup-mcp complete Markdown inventory"]:::boundary
    n21["clickup-mcp documentation map"]:::knowledge
    n22["clickup-mcp repository OKF visualization"]:::boundary
    n23["Live Runtime Tool Tests"]:::boundary
    n24["Live Smoke Harness"]:::boundary
    n25["Live Verification: Initial Pass"]:::boundary
    n26["Manifest vs Runtime Drift"]:::boundary
    n27["Non-Live Validation Probe"]:::boundary
    n28["Plans"]:::boundary
    n29["Tool Availability Policy"]:::boundary
    n30["Tool Trust Model"]:::boundary
    n31["Product Sense"]:::boundary
    n32["Public Spec Comparison"]:::boundary
    n33["Quality Score"]:::boundary
    n34["Refactor and Repair Plan"]:::boundary
    n35["Reliability"]:::boundary
    n36["Security"]:::boundary
    n37["Status Artefacts"]:::boundary
    n38["Tool Reference"]:::boundary
    n39["Unmatched Endpoint Classification"]:::boundary
    n40["Glossary"]:::boundary
    n41["ClickUp MCP"]:::boundary
    n42["Adopt RKE OKF knowledge format · done"]:::boundary
    n0 -->|links| n2
    n0 -->|links| n34
    n0 -->|links| n21
    n1 -->|links| n28
    n1 -->|links| n21
    n2 -->|links| n38
    n2 -->|links| n3
    n2 -->|links| n21
    n3 -->|links| n10
    n3 -->|links| n14
    n3 -->|links| n24
    n3 -->|links| n2
    n3 -->|links| n27
    n3 -->|links| n21
    n4 -->|links| n21
    n5 -->|links| n21
    n6 -->|links| n21
    n7 -->|links| n21
    n8 -->|links| n21
    n9 -->|links| n21
    n10 -->|links| n21
    n11 -->|links| n21
    n12 -->|links| n26
    n12 -->|links| n21
    n13 -->|links| n21
    n14 -->|links| n21
    n15 -->|links| n21
    n16 -->|links| n21
    n17 -->|links| n23
    n17 -->|links| n4
    n17 -->|links| n21
    n18 -->|links| n24
    n18 -->|links| n21
    n19 -->|links| n21
    n20 -->|links| n0
    n20 -->|links| n1
    n20 -->|links| n2
    n20 -->|links| n3
    n20 -->|links| n4
    n20 -->|links| n5
    n20 -->|links| n6
    n20 -->|links| n7
    n20 -->|links| n8
    n20 -->|links| n9
    n20 -->|links| n10
    n20 -->|links| n11
    n20 -->|links| n12
    n20 -->|links| n13
    n20 -->|links| n14
    n20 -->|links| n15
    n20 -->|links| n16
    n20 -->|links| n17
    n20 -->|links| n18
    n20 -->|links| n19
    n20 -->|links| n21
    n20 -->|links| n22
    n20 -->|links| n23
    n20 -->|links| n24
    n20 -->|links| n25
    n20 -->|links| n26
    n20 -->|links| n27
    n20 -->|links| n28
    n20 -->|links| n29
    n20 -->|links| n30
    n20 -->|links| n31
    n20 -->|links| n32
    n20 -->|links| n33
    n20 -->|links| n34
    n20 -->|links| n35
    n20 -->|links| n36
    n20 -->|links| n37
    n20 -->|links| n38
    n20 -->|links| n39
    n20 -->|links| n40
    n20 -->|links| n41
    n20 -->|links| n42
    n21 -->|links| n41
    n21 -->|links| n20
    n21 -->|links| n0
    n21 -->|links| n2
    n21 -->|links| n1
    n21 -->|links| n5
    n21 -->|links| n6
    n21 -->|links| n7
    n21 -->|links| n8
    n21 -->|links| n9
    n21 -->|links| n17
    n21 -->|links| n18
    n21 -->|links| n19
    n21 -->|links| n28
    n21 -->|links| n34
    n21 -->|links| n11
    n21 -->|links| n14
    n21 -->|links| n15
    n21 -->|links| n40
    n21 -->|links| n16
    n21 -->|links| n37
    n21 -->|links| n12
    n21 -->|links| n29
    n21 -->|links| n30
    n21 -->|links| n33
    n21 -->|links| n3
    n21 -->|links| n38
    n21 -->|links| n35
    n21 -->|links| n4
    n21 -->|links| n23
    n21 -->|links| n26
    n21 -->|links| n31
    n21 -->|links| n32
    n21 -->|links| n39
    n21 -->|links| n10
    n21 -->|links| n36
    n21 -->|links| n13
    n21 -->|links| n24
    n21 -->|links| n25
    n21 -->|links| n27
    n21 -->|links| n42
    n21 -->|links| n22
    n22 -->|links| n21
    n22 -->|links| n20
    n22 -->|links| n42
    n23 -->|links| n21
    n24 -->|links| n21
    n25 -->|links| n21
    n26 -->|links| n21
    n27 -->|links| n21
    n28 -->|links| n38
    n28 -->|links| n41
    n28 -->|links| n17
    n28 -->|links| n18
    n28 -->|links| n34
    n28 -->|links| n21
    n29 -->|links| n38
    n29 -->|links| n34
    n29 -->|links| n21
    n30 -->|links| n21
    n31 -->|links| n21
    n32 -->|links| n21
    n33 -->|links| n21
    n34 -->|links| n18
    n34 -->|links| n2
    n34 -->|links| n27
    n34 -->|links| n26
    n34 -->|links| n32
    n34 -->|links| n39
    n34 -->|links| n25
    n34 -->|links| n23
    n34 -->|links| n4
    n34 -->|links| n38
    n34 -->|links| n3
    n34 -->|links| n41
    n34 -->|links| n21
    n35 -->|links| n23
    n35 -->|links| n4
    n35 -->|links| n21
    n36 -->|links| n10
    n36 -->|links| n14
    n36 -->|links| n3
    n36 -->|links| n21
    n37 -->|links| n38
    n37 -->|links| n21
    n38 -->|links| n23
    n38 -->|links| n4
    n38 -->|links| n26
    n38 -->|links| n27
    n38 -->|links| n34
    n38 -->|links| n2
    n38 -->|links| n21
    n39 -->|links| n21
    n40 -->|links| n21
    n41 -->|links| n3
    n41 -->|links| n38
    n41 -->|links| n0
    n41 -->|links| n21
    n42 -->|links| n21
    n42 -->|links| n22
    classDef task fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef workstream fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef tracker fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef knowledge fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef boundary fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-dasharray:4 3
```

### clickup-mcp complete Markdown inventory

```mermaid
flowchart LR
    n0["Architecture"]:::boundary
    n1["Archive"]:::boundary
    n2["Codebase Map"]:::boundary
    n3["Configuration"]:::boundary
    n4["Correct Endpoints and Functionality"]:::boundary
    n5["0001 Platform Status Model"]:::boundary
    n6["0002 Evidence Freshness And Validation"]:::boundary
    n7["0003 Status Actionability"]:::boundary
    n8["0004 Canonical Status Artefact"]:::boundary
    n9["0005 Canonical Status Schema"]:::boundary
    n10["Auth Principles"]:::boundary
    n11["Core Beliefs"]:::boundary
    n12["Tool Contract Principles"]:::boundary
    n13["Validation Harness Principles"]:::boundary
    n14["Write Safety Principles"]:::boundary
    n15["Design"]:::boundary
    n16["Active Execution Plans"]:::boundary
    n17["Runtime Repair Plan"]:::boundary
    n18["Harness Engineering Plan"]:::boundary
    n19["Tech Debt Tracker"]:::boundary
    n20["clickup-mcp complete Markdown inventory"]:::knowledge
    n21["clickup-mcp documentation map"]:::boundary
    n22["clickup-mcp repository OKF visualization"]:::boundary
    n23["Live Runtime Tool Tests"]:::boundary
    n24["Live Smoke Harness"]:::boundary
    n25["Live Verification: Initial Pass"]:::boundary
    n26["Manifest vs Runtime Drift"]:::boundary
    n27["Non-Live Validation Probe"]:::boundary
    n28["Plans"]:::boundary
    n29["Tool Availability Policy"]:::boundary
    n30["Tool Trust Model"]:::boundary
    n31["Product Sense"]:::boundary
    n32["Public Spec Comparison"]:::boundary
    n33["Quality Score"]:::boundary
    n34["Refactor and Repair Plan"]:::boundary
    n35["Reliability"]:::boundary
    n36["Security"]:::boundary
    n37["Status Artefacts"]:::boundary
    n38["Tool Reference"]:::boundary
    n39["Unmatched Endpoint Classification"]:::boundary
    n40["Glossary"]:::boundary
    n41["ClickUp MCP"]:::boundary
    n42["Adopt RKE OKF knowledge format · done"]:::boundary
    n0 -->|links| n2
    n0 -->|links| n34
    n0 -->|links| n21
    n1 -->|links| n28
    n1 -->|links| n21
    n2 -->|links| n38
    n2 -->|links| n3
    n2 -->|links| n21
    n3 -->|links| n10
    n3 -->|links| n14
    n3 -->|links| n24
    n3 -->|links| n2
    n3 -->|links| n27
    n3 -->|links| n21
    n4 -->|links| n21
    n5 -->|links| n21
    n6 -->|links| n21
    n7 -->|links| n21
    n8 -->|links| n21
    n9 -->|links| n21
    n10 -->|links| n21
    n11 -->|links| n21
    n12 -->|links| n26
    n12 -->|links| n21
    n13 -->|links| n21
    n14 -->|links| n21
    n15 -->|links| n21
    n16 -->|links| n21
    n17 -->|links| n23
    n17 -->|links| n4
    n17 -->|links| n21
    n18 -->|links| n24
    n18 -->|links| n21
    n19 -->|links| n21
    n20 -->|links| n0
    n20 -->|links| n1
    n20 -->|links| n2
    n20 -->|links| n3
    n20 -->|links| n4
    n20 -->|links| n5
    n20 -->|links| n6
    n20 -->|links| n7
    n20 -->|links| n8
    n20 -->|links| n9
    n20 -->|links| n10
    n20 -->|links| n11
    n20 -->|links| n12
    n20 -->|links| n13
    n20 -->|links| n14
    n20 -->|links| n15
    n20 -->|links| n16
    n20 -->|links| n17
    n20 -->|links| n18
    n20 -->|links| n19
    n20 -->|links| n21
    n20 -->|links| n22
    n20 -->|links| n23
    n20 -->|links| n24
    n20 -->|links| n25
    n20 -->|links| n26
    n20 -->|links| n27
    n20 -->|links| n28
    n20 -->|links| n29
    n20 -->|links| n30
    n20 -->|links| n31
    n20 -->|links| n32
    n20 -->|links| n33
    n20 -->|links| n34
    n20 -->|links| n35
    n20 -->|links| n36
    n20 -->|links| n37
    n20 -->|links| n38
    n20 -->|links| n39
    n20 -->|links| n40
    n20 -->|links| n41
    n20 -->|links| n42
    n21 -->|links| n41
    n21 -->|links| n20
    n21 -->|links| n0
    n21 -->|links| n2
    n21 -->|links| n1
    n21 -->|links| n5
    n21 -->|links| n6
    n21 -->|links| n7
    n21 -->|links| n8
    n21 -->|links| n9
    n21 -->|links| n17
    n21 -->|links| n18
    n21 -->|links| n19
    n21 -->|links| n28
    n21 -->|links| n34
    n21 -->|links| n11
    n21 -->|links| n14
    n21 -->|links| n15
    n21 -->|links| n40
    n21 -->|links| n16
    n21 -->|links| n37
    n21 -->|links| n12
    n21 -->|links| n29
    n21 -->|links| n30
    n21 -->|links| n33
    n21 -->|links| n3
    n21 -->|links| n38
    n21 -->|links| n35
    n21 -->|links| n4
    n21 -->|links| n23
    n21 -->|links| n26
    n21 -->|links| n31
    n21 -->|links| n32
    n21 -->|links| n39
    n21 -->|links| n10
    n21 -->|links| n36
    n21 -->|links| n13
    n21 -->|links| n24
    n21 -->|links| n25
    n21 -->|links| n27
    n21 -->|links| n42
    n21 -->|links| n22
    n22 -->|links| n21
    n22 -->|links| n20
    n22 -->|links| n42
    n23 -->|links| n21
    n24 -->|links| n21
    n25 -->|links| n21
    n26 -->|links| n21
    n27 -->|links| n21
    n28 -->|links| n38
    n28 -->|links| n41
    n28 -->|links| n17
    n28 -->|links| n18
    n28 -->|links| n34
    n28 -->|links| n21
    n29 -->|links| n38
    n29 -->|links| n34
    n29 -->|links| n21
    n30 -->|links| n21
    n31 -->|links| n21
    n32 -->|links| n21
    n33 -->|links| n21
    n34 -->|links| n18
    n34 -->|links| n2
    n34 -->|links| n27
    n34 -->|links| n26
    n34 -->|links| n32
    n34 -->|links| n39
    n34 -->|links| n25
    n34 -->|links| n23
    n34 -->|links| n4
    n34 -->|links| n38
    n34 -->|links| n3
    n34 -->|links| n41
    n34 -->|links| n21
    n35 -->|links| n23
    n35 -->|links| n4
    n35 -->|links| n21
    n36 -->|links| n10
    n36 -->|links| n14
    n36 -->|links| n3
    n36 -->|links| n21
    n37 -->|links| n38
    n37 -->|links| n21
    n38 -->|links| n23
    n38 -->|links| n4
    n38 -->|links| n26
    n38 -->|links| n27
    n38 -->|links| n34
    n38 -->|links| n2
    n38 -->|links| n21
    n39 -->|links| n21
    n40 -->|links| n21
    n41 -->|links| n3
    n41 -->|links| n38
    n41 -->|links| n0
    n41 -->|links| n21
    n42 -->|links| n21
    n42 -->|links| n22
    classDef task fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef workstream fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef tracker fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef knowledge fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef boundary fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-dasharray:4 3
```

### Refactor and Repair Plan

```mermaid
flowchart LR
    n0["Architecture"]:::boundary
    n1["Codebase Map"]:::boundary
    n2["Configuration"]:::boundary
    n3["Correct Endpoints and Functionality"]:::boundary
    n4["Harness Engineering Plan"]:::boundary
    n5["clickup-mcp complete Markdown inventory"]:::boundary
    n6["clickup-mcp documentation map"]:::boundary
    n7["Live Runtime Tool Tests"]:::boundary
    n8["Live Verification: Initial Pass"]:::boundary
    n9["Manifest vs Runtime Drift"]:::boundary
    n10["Non-Live Validation Probe"]:::boundary
    n11["Plans"]:::boundary
    n12["Tool Availability Policy"]:::boundary
    n13["Public Spec Comparison"]:::boundary
    n14["Refactor and Repair Plan"]:::knowledge
    n15["Tool Reference"]:::boundary
    n16["Unmatched Endpoint Classification"]:::boundary
    n17["ClickUp MCP"]:::boundary
    n0 -->|links| n1
    n0 -->|links| n14
    n0 -->|links| n6
    n1 -->|links| n15
    n1 -->|links| n2
    n1 -->|links| n6
    n2 -->|links| n1
    n2 -->|links| n10
    n2 -->|links| n6
    n3 -->|links| n6
    n4 -->|links| n6
    n5 -->|links| n0
    n5 -->|links| n1
    n5 -->|links| n2
    n5 -->|links| n3
    n5 -->|links| n4
    n5 -->|links| n6
    n5 -->|links| n7
    n5 -->|links| n8
    n5 -->|links| n9
    n5 -->|links| n10
    n5 -->|links| n11
    n5 -->|links| n12
    n5 -->|links| n13
    n5 -->|links| n14
    n5 -->|links| n15
    n5 -->|links| n16
    n5 -->|links| n17
    n6 -->|links| n17
    n6 -->|links| n5
    n6 -->|links| n0
    n6 -->|links| n1
    n6 -->|links| n4
    n6 -->|links| n11
    n6 -->|links| n14
    n6 -->|links| n12
    n6 -->|links| n2
    n6 -->|links| n15
    n6 -->|links| n3
    n6 -->|links| n7
    n6 -->|links| n9
    n6 -->|links| n13
    n6 -->|links| n16
    n6 -->|links| n8
    n6 -->|links| n10
    n7 -->|links| n6
    n8 -->|links| n6
    n9 -->|links| n6
    n10 -->|links| n6
    n11 -->|links| n15
    n11 -->|links| n17
    n11 -->|links| n4
    n11 -->|links| n14
    n11 -->|links| n6
    n12 -->|links| n15
    n12 -->|links| n14
    n12 -->|links| n6
    n13 -->|links| n6
    n14 -->|links| n4
    n14 -->|links| n1
    n14 -->|links| n10
    n14 -->|links| n9
    n14 -->|links| n13
    n14 -->|links| n16
    n14 -->|links| n8
    n14 -->|links| n7
    n14 -->|links| n3
    n14 -->|links| n15
    n14 -->|links| n2
    n14 -->|links| n17
    n14 -->|links| n6
    n15 -->|links| n7
    n15 -->|links| n3
    n15 -->|links| n9
    n15 -->|links| n10
    n15 -->|links| n14
    n15 -->|links| n1
    n15 -->|links| n6
    n16 -->|links| n6
    n17 -->|links| n2
    n17 -->|links| n15
    n17 -->|links| n0
    n17 -->|links| n6
    classDef task fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef workstream fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef tracker fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef knowledge fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef boundary fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-dasharray:4 3
```

### Tool Reference

```mermaid
flowchart LR
    n0["Codebase Map"]:::boundary
    n1["Correct Endpoints and Functionality"]:::boundary
    n2["clickup-mcp complete Markdown inventory"]:::boundary
    n3["clickup-mcp documentation map"]:::boundary
    n4["Live Runtime Tool Tests"]:::boundary
    n5["Manifest vs Runtime Drift"]:::boundary
    n6["Non-Live Validation Probe"]:::boundary
    n7["Plans"]:::boundary
    n8["Tool Availability Policy"]:::boundary
    n9["Refactor and Repair Plan"]:::boundary
    n10["Status Artefacts"]:::boundary
    n11["Tool Reference"]:::knowledge
    n12["ClickUp MCP"]:::boundary
    n0 -->|links| n11
    n0 -->|links| n3
    n1 -->|links| n3
    n2 -->|links| n0
    n2 -->|links| n1
    n2 -->|links| n3
    n2 -->|links| n4
    n2 -->|links| n5
    n2 -->|links| n6
    n2 -->|links| n7
    n2 -->|links| n8
    n2 -->|links| n9
    n2 -->|links| n10
    n2 -->|links| n11
    n2 -->|links| n12
    n3 -->|links| n12
    n3 -->|links| n2
    n3 -->|links| n0
    n3 -->|links| n7
    n3 -->|links| n9
    n3 -->|links| n10
    n3 -->|links| n8
    n3 -->|links| n11
    n3 -->|links| n1
    n3 -->|links| n4
    n3 -->|links| n5
    n3 -->|links| n6
    n4 -->|links| n3
    n5 -->|links| n3
    n6 -->|links| n3
    n7 -->|links| n11
    n7 -->|links| n12
    n7 -->|links| n9
    n7 -->|links| n3
    n8 -->|links| n11
    n8 -->|links| n9
    n8 -->|links| n3
    n9 -->|links| n0
    n9 -->|links| n6
    n9 -->|links| n5
    n9 -->|links| n4
    n9 -->|links| n1
    n9 -->|links| n11
    n9 -->|links| n12
    n9 -->|links| n3
    n10 -->|links| n11
    n10 -->|links| n3
    n11 -->|links| n4
    n11 -->|links| n1
    n11 -->|links| n5
    n11 -->|links| n6
    n11 -->|links| n9
    n11 -->|links| n0
    n11 -->|links| n3
    n12 -->|links| n11
    n12 -->|links| n3
    classDef task fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef workstream fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef tracker fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef knowledge fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef boundary fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-dasharray:4 3
```

### Configuration

```mermaid
flowchart LR
    n0["Codebase Map"]:::boundary
    n1["Configuration"]:::knowledge
    n2["Auth Principles"]:::boundary
    n3["Write Safety Principles"]:::boundary
    n4["clickup-mcp complete Markdown inventory"]:::boundary
    n5["clickup-mcp documentation map"]:::boundary
    n6["Live Smoke Harness"]:::boundary
    n7["Non-Live Validation Probe"]:::boundary
    n8["Refactor and Repair Plan"]:::boundary
    n9["Security"]:::boundary
    n10["ClickUp MCP"]:::boundary
    n0 -->|links| n1
    n0 -->|links| n5
    n1 -->|links| n2
    n1 -->|links| n3
    n1 -->|links| n6
    n1 -->|links| n0
    n1 -->|links| n7
    n1 -->|links| n5
    n2 -->|links| n5
    n3 -->|links| n5
    n4 -->|links| n0
    n4 -->|links| n1
    n4 -->|links| n2
    n4 -->|links| n3
    n4 -->|links| n5
    n4 -->|links| n6
    n4 -->|links| n7
    n4 -->|links| n8
    n4 -->|links| n9
    n4 -->|links| n10
    n5 -->|links| n10
    n5 -->|links| n4
    n5 -->|links| n0
    n5 -->|links| n8
    n5 -->|links| n3
    n5 -->|links| n1
    n5 -->|links| n2
    n5 -->|links| n9
    n5 -->|links| n6
    n5 -->|links| n7
    n6 -->|links| n5
    n7 -->|links| n5
    n8 -->|links| n0
    n8 -->|links| n7
    n8 -->|links| n1
    n8 -->|links| n10
    n8 -->|links| n5
    n9 -->|links| n2
    n9 -->|links| n3
    n9 -->|links| n1
    n9 -->|links| n5
    n10 -->|links| n1
    n10 -->|links| n5
    classDef task fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef workstream fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef tracker fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef knowledge fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef boundary fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-dasharray:4 3
```

### Plans

```mermaid
flowchart LR
    n0["Archive"]:::boundary
    n1["Runtime Repair Plan"]:::boundary
    n2["Harness Engineering Plan"]:::boundary
    n3["clickup-mcp complete Markdown inventory"]:::boundary
    n4["clickup-mcp documentation map"]:::boundary
    n5["Plans"]:::knowledge
    n6["Refactor and Repair Plan"]:::boundary
    n7["Tool Reference"]:::boundary
    n8["ClickUp MCP"]:::boundary
    n0 -->|links| n5
    n0 -->|links| n4
    n1 -->|links| n4
    n2 -->|links| n4
    n3 -->|links| n0
    n3 -->|links| n1
    n3 -->|links| n2
    n3 -->|links| n4
    n3 -->|links| n5
    n3 -->|links| n6
    n3 -->|links| n7
    n3 -->|links| n8
    n4 -->|links| n8
    n4 -->|links| n3
    n4 -->|links| n0
    n4 -->|links| n1
    n4 -->|links| n2
    n4 -->|links| n5
    n4 -->|links| n6
    n4 -->|links| n7
    n5 -->|links| n7
    n5 -->|links| n8
    n5 -->|links| n1
    n5 -->|links| n2
    n5 -->|links| n6
    n5 -->|links| n4
    n6 -->|links| n2
    n6 -->|links| n7
    n6 -->|links| n8
    n6 -->|links| n4
    n7 -->|links| n6
    n7 -->|links| n4
    n8 -->|links| n7
    n8 -->|links| n4
    classDef task fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef workstream fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef tracker fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef knowledge fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef boundary fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-dasharray:4 3
```

## Legend

- Blue: task
- Purple: workstream
- Orange: tracker profile
- Green: durable knowledge
- Dashed neutral nodes: neighbouring context repeated from another area or key-concept view
- Time references: edges to addressable `Task.time[]` fragments
- Arrows: structured relationships or repository-local Markdown links
