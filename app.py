from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import os

app = Flask(__name__)

# ---------------- CONFIG ----------------
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

df = None          # Original uploaded dataframe
result_df = None   # Latest analysis result dataframe


# ---------------- HOME ----------------
@app.route("/")
def index():
    return render_template("index.html")


# ---------------- ABOUT ----------------
@app.route("/about")
def about():
    return render_template("aboutus.html")


# ---------------- UPLOAD ----------------
@app.route("/upload", methods=["POST"])
def upload_file():
    global df, result_df

    result_df = None  # reset previous result

    if "file" not in request.files:
        return jsonify({"error": "No file part"})

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"})

    filepath = os.path.join(app.config["UPLOAD_FOLDER"], file.filename)
    file.save(filepath)

    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(filepath)
        else:
            df = pd.read_excel(filepath)
    except Exception as e:
        return jsonify({"error": str(e)})

    numeric_columns = df.select_dtypes(include="number").columns.tolist()

    return jsonify({
        "preview": df.head(10).to_html(index=False, classes="table"),
        "columns": df.columns.tolist(),
        "numeric_columns": numeric_columns
    })


# ---------------- ANALYZE ----------------
@app.route("/analyze", methods=["POST"])
def analyze():
    global df, result_df

    if df is None:
        return jsonify({"error": "No file uploaded"})

    data = request.get_json()
    operation = data.get("operation")

    try:
        # ---------- BASE KPIs ----------
        kpis = {
            "rows": int(len(df)),
            "sum": 0,
            "avg": 0,
            "max": 0,
            "min": 0
        }

        # ================= SUM / AVERAGE =================
        if operation in ["sum", "average"]:
            column = data.get("column")

            if column not in df.columns:
                return jsonify({"error": f"Column '{column}' not found"})

            if not pd.api.types.is_numeric_dtype(df[column]):
                return jsonify({"error": f"Column '{column}' must be numeric"})

            series = df[column].dropna()

            kpis.update({
                "sum": float(series.sum()),
                "avg": float(series.mean()),
                "max": float(series.max()),
                "min": float(series.min())
            })

            value = kpis["sum"] if operation == "sum" else kpis["avg"]

            # ✅ STORE RESULT DF
            result_df = pd.DataFrame({
                "Metric": ["Sum", "Average", "Max", "Min"],
                column: [kpis["sum"], kpis["avg"], kpis["max"], kpis["min"]]
            })

            return jsonify({
                "result": f"<b>{operation.title()} of {column}</b>: {round(value, 2)}",
                "kpis": kpis,
                "chart": {
                    "labels": ["Sum", "Average", "Max", "Min"],
                    "values": [kpis["sum"], kpis["avg"], kpis["max"], kpis["min"]],
                    "title": f"{column} Statistics"
                }
            })

        # ================= TOP N =================
        if operation == "top":
            column = data.get("column")
            n = int(data.get("n", 5))

            if column not in df.columns:
                return jsonify({"error": f"Column '{column}' not found"})

            if not pd.api.types.is_numeric_dtype(df[column]):
                return jsonify({"error": f"Column '{column}' must be numeric"})

            result_df = df.nlargest(n, column).copy()
            series = result_df[column].dropna()

            kpis.update({
                "sum": float(series.sum()),
                "avg": float(series.mean()),
                "max": float(series.max()),
                "min": float(series.min())
            })

            return jsonify({
                "result": result_df.to_html(index=False, classes="table"),
                "kpis": kpis,
                "chart": {
                    "labels": result_df.index.astype(str).tolist(),
                    "values": series.astype(float).tolist(),
                    "title": f"Top {n} values of {column}"
                }
            })

        # ================= GROUP BY =================
        if operation == "group":
            group_column = data.get("group_col")
            value_column = data.get("column")
            aggregation = data.get("agg", "sum")

            if group_column not in df.columns or value_column not in df.columns:
                return jsonify({"error": "Invalid column selection"})

            if not pd.api.types.is_numeric_dtype(df[value_column]):
                return jsonify({"error": f"Column '{value_column}' must be numeric"})

            if aggregation == "sum":
                grouped = df.groupby(group_column)[value_column].sum()
            else:
                grouped = df.groupby(group_column)[value_column].mean()

            result_df = grouped.reset_index()
            series = result_df[value_column]

            kpis.update({
                "sum": float(series.sum()),
                "avg": float(series.mean()),
                "max": float(series.max()),
                "min": float(series.min())
            })

            return jsonify({
                "result": result_df.to_html(index=False, classes="table"),
                "kpis": kpis,
                "chart": {
                    "labels": result_df[group_column].astype(str).tolist(),
                    "values": series.astype(float).tolist(),
                    "title": f"{aggregation.title()} of {value_column} by {group_column}"
                }
            })

        return jsonify({"error": "Invalid operation"})

    except Exception as e:
        return jsonify({"error": f"Error: {str(e)}"})


# ---------------- DOWNLOAD EXCEL ----------------
@app.route("/download-excel")
def download_excel():
    global result_df

    if result_df is None:
        return "No analysis result to download", 400

    output_path = os.path.join(
        app.config["UPLOAD_FOLDER"],
        "analysis_result.xlsx"
    )

    result_df.to_excel(output_path, index=False)
    return send_file(output_path, as_attachment=True)


# ---------------- RUN ----------------
if __name__ == "__main__":
    app.run(debug=True)
